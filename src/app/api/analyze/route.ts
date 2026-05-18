import { NextResponse } from "next/server";
import { analyzeSchema } from "@/lib/validators/analyzeSchema";
import {
  getAnalysisQueue,
  getAnalysisQueueJobOptions,
} from "@/lib/analysis/jobQueue";
import {
  createPendingAnalysisJob,
  markAnalysisJobEnqueueFailed,
  setAnalysisJobQueueJobId,
} from "@/lib/db/analysisJobs";
import { redactApiKey } from "@/lib/ai/redact";
import { getCurrentUser } from "@/lib/auth/session";
import { logger } from "@/lib/utils/logger";
import { QueueUnavailableError, toAppError } from "@/lib/utils/errors";

export const runtime = "nodejs";
export const maxDuration = 15;

function errorResponse(error: unknown, startedAt: number) {
  const appError = toAppError(error);
  const safeMessage = redactApiKey(appError.message);

  logger.error("analysis.enqueue_failed", {
    failureType: appError.code,
    durationMs: Date.now() - startedAt,
  });

  return NextResponse.json(
    {
      error: {
        code: appError.code,
        message: safeMessage,
      },
    },
    { status: appError.status },
  );
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Sign in to analyze repositories and save reports.",
          },
        },
        { status: 401 },
      );
    }

    const json = await request.json();
    const input = analyzeSchema.parse(json);
    const job = await createPendingAnalysisJob({
      userId: user.id,
      repoUrl: input.repoUrl,
      apiKey: input.apiKey,
      analysisDepth: input.analysisDepth,
      agentIds: input.agentIds,
    });

    try {
      const queueJob = await getAnalysisQueue().add(
        "run-analysis",
        { analysisJobId: job.jobId },
        {
          ...getAnalysisQueueJobOptions(),
          jobId: job.jobId,
        },
      );
      await setAnalysisJobQueueJobId(job.jobId, String(queueJob.id));
    } catch (error) {
      const queueError = new QueueUnavailableError();
      await markAnalysisJobEnqueueFailed(job.jobId, queueError.message);
      logger.error("analysis.queue_add_failed", {
        jobId: job.jobId,
        reportId: job.reportId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw queueError;
    }

    logger.info("analysis.enqueued", {
      jobId: job.jobId,
      reportId: job.reportId,
      userId: user.id,
      analysisDepth: input.analysisDepth,
      agentIds: input.agentIds,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json(
      {
        jobId: job.jobId,
        reportId: job.reportId,
        status: "pending",
      },
      { status: 202 },
    );
  } catch (error) {
    return errorResponse(error, startedAt);
  }
}
