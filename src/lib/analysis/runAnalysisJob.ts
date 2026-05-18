import type { Job } from "bullmq";
import {
  prepareRepositoryAnalysis,
  runPreparedRepositoryAnalysis,
} from "@/lib/analysis/runRepositoryAnalysis";
import type { AnalysisQueueJobData } from "@/lib/analysis/jobQueue";
import { getAnalysisDeadLetterQueue } from "@/lib/analysis/jobQueue";
import type { AnalysisProgressPayload } from "@/lib/analysis/progress";
import {
  assertAnalysisJobActive,
  completeAnalysisJob,
  failAnalysisJob,
  heartbeatAnalysisJob,
  markAnalysisJobRetrying,
  persistAnalysisProgress,
  startAnalysisJob,
  type AnalysisJobWorkerRecord,
} from "@/lib/db/analysisJobs";
import { upsertRepository } from "@/lib/db/repositories";
import { completeReport, updateReportRepository } from "@/lib/db/reports";
import { redactApiKey } from "@/lib/ai/redact";
import { getGithubUserAccessToken } from "@/lib/github/oauth";
import {
  AppError,
  AnalysisCancelledError,
  AnalysisFailedError,
  AnalysisTimeoutError,
  toAppError,
} from "@/lib/utils/errors";
import { logger } from "@/lib/utils/logger";

const CANCELLATION_POLL_MS = 2_000;

function timeoutErrorFromAbort(error: unknown): Error | null {
  if (error instanceof AnalysisCancelledError || error instanceof AnalysisTimeoutError) {
    return error;
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return new AnalysisTimeoutError();
  }

  if (error instanceof Error && error.name === "AbortError") {
    return new AnalysisTimeoutError();
  }

  return null;
}

async function addDeadLetter(input: {
  analysisJobId: string;
  reportId: string;
  errorCode: string;
  errorMessage: string;
  attemptsMade: number;
}) {
  await getAnalysisDeadLetterQueue().add("analysis.dead-letter", input, {
    removeOnComplete: false,
    removeOnFail: false,
  });
}

async function getGithubTokenForAnalysis(userId: string | null) {
  if (!userId) {
    return undefined;
  }

  const token = await getGithubUserAccessToken(userId);
  if (token.ok) {
    return token.token;
  }

  throw new AppError(token.code, token.message, token.status);
}

export async function runAnalysisQueueJob(job: Job<AnalysisQueueJobData>) {
  const startedAt = Date.now();
  const attempt = job.attemptsMade + 1;
  let analysisJob: AnalysisJobWorkerRecord;
  try {
    analysisJob = await startAnalysisJob(job.data.analysisJobId, attempt);
  } catch (error) {
    const appError = toAppError(error);
    if (appError.code === "ANALYSIS_CANCELLED") {
      return;
    }
    throw error;
  }
  const abortController = new AbortController();
  let activeStep: AnalysisProgressPayload["step"] | undefined;

  const timeout = setTimeout(() => {
    abortController.abort(new AnalysisTimeoutError());
  }, analysisJob.timeoutMs);

  const cancellationPoll = setInterval(() => {
    void assertAnalysisJobActive(analysisJob.id).catch((error) => {
      abortController.abort(error);
    });
  }, CANCELLATION_POLL_MS);

  async function emitProgress(event: AnalysisProgressPayload) {
    await assertAnalysisJobActive(analysisJob.id);
    activeStep = event.status === "running" ? event.step : undefined;
    await persistAnalysisProgress(analysisJob.id, event);
  }

  try {
    await heartbeatAnalysisJob(analysisJob.id);
    const githubAccessToken = await getGithubTokenForAnalysis(analysisJob.userId);

    const prepared = await prepareRepositoryAnalysis({
      repoUrl: analysisJob.repoUrl,
      analysisDepth: analysisJob.analysisDepth,
      githubAccessToken,
      onProgress: emitProgress,
      signal: abortController.signal,
    });

    const repository = await upsertRepository({
      owner: prepared.repository.owner,
      name: prepared.repository.name,
      url: prepared.repository.url,
      defaultBranch: prepared.repository.defaultBranch,
    });
    await updateReportRepository({
      reportId: analysisJob.reportId,
      repositoryId: repository.id,
    });

    const analysis = await runPreparedRepositoryAnalysis({
      apiKey: analysisJob.apiKey,
      prepared,
      selectedAgentIds: analysisJob.selectedAgentIds,
      onProgress: emitProgress,
      signal: abortController.signal,
    });

    await emitProgress({
      step: "persist-report",
      status: "running",
      message: "Saving report findings and recommendations.",
    });
    await completeReport({
      reportId: analysisJob.reportId,
      report: analysis.report,
      selectedFiles: analysis.selectedFiles,
    });
    await emitProgress({
      step: "persist-report",
      status: "completed",
      message: "Report saved. Opening results.",
    });

    await completeAnalysisJob(analysisJob.id);

    logger.info("analysis.completed", {
      jobId: analysisJob.id,
      reportId: analysisJob.reportId,
      repo: `${analysis.repository.owner}/${analysis.repository.name}`,
      userId: analysisJob.userId,
      analysisDepth: analysisJob.analysisDepth,
      selectedAgentIds: analysisJob.selectedAgentIds,
      filesSelected: analysis.selectedFiles.length,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    const abortError = timeoutErrorFromAbort(abortController.signal.reason ?? error);
    const appError = toAppError(abortError ?? error);
    const safeMessage = redactApiKey(appError.message);

    if (activeStep) {
      await persistAnalysisProgress(analysisJob.id, {
        step: activeStep,
        status: "failed",
        message: safeMessage,
      });
    }

    const isCancellation = appError instanceof AnalysisCancelledError || appError.code === "ANALYSIS_CANCELLED";
    const isTimeout = appError instanceof AnalysisTimeoutError || appError.code === "ANALYSIS_TIMEOUT";
    const isFinalAttempt = isCancellation || isTimeout || attempt >= analysisJob.maxAttempts;

    if (!isFinalAttempt) {
      await markAnalysisJobRetrying({
        jobId: analysisJob.id,
        attempt,
        errorCode: appError.code,
        errorMessage: safeMessage,
      });

      logger.error("analysis.retrying", {
        jobId: analysisJob.id,
        reportId: analysisJob.reportId,
        userId: analysisJob.userId,
        failureType: appError.code,
        attempt,
      });

      throw appError;
    }

    const shouldDeadLetter = !isCancellation;
    let deadLettered = false;
    if (shouldDeadLetter) {
      try {
        await addDeadLetter({
          analysisJobId: analysisJob.id,
          reportId: analysisJob.reportId,
          errorCode: appError.code,
          errorMessage: safeMessage,
          attemptsMade: attempt,
        });
        deadLettered = true;
      } catch (deadLetterError) {
        logger.error("analysis.dead_letter_enqueue_failed", {
          jobId: analysisJob.id,
          reportId: analysisJob.reportId,
          error: deadLetterError instanceof Error ? deadLetterError.message : String(deadLetterError),
        });
      }
    }

    await failAnalysisJob({
      jobId: analysisJob.id,
      errorCode: appError.code,
      errorMessage: safeMessage,
      deadLetter: deadLettered,
    });

    logger.error("analysis.failed", {
      jobId: analysisJob.id,
      reportId: analysisJob.reportId,
      userId: analysisJob.userId,
      failureType: appError.code,
      attempt,
      deadLetter: deadLettered,
      durationMs: Date.now() - startedAt,
    });

    if (isCancellation) {
      return;
    }

    throw appError instanceof Error ? appError : new AnalysisFailedError(safeMessage);
  } finally {
    clearTimeout(timeout);
    clearInterval(cancellationPoll);
  }
}
