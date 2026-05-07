import { NextResponse } from "next/server";
import { analyzeSchema, type AnalyzeInput } from "@/lib/validators/analyzeSchema";
import {
  prepareRepositoryAnalysis,
  runPreparedRepositoryAnalysis,
} from "@/lib/analysis/runRepositoryAnalysis";
import type { AnalysisProgressEvent, AnalysisProgressPayload } from "@/lib/analysis/progress";
import { upsertRepository } from "@/lib/db/repositories";
import { completeReport, createReport, failReport, markReportRunning } from "@/lib/db/reports";
import { redactApiKey } from "@/lib/ai/redact";
import { getCurrentUser } from "@/lib/auth/session";
import { logger } from "@/lib/utils/logger";
import { toAppError } from "@/lib/utils/errors";

export const runtime = "nodejs";
export const maxDuration = 60;

type AnalyzeExecutionResult =
  | {
      ok: true;
      reportId: string;
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        status: number;
      };
      reportId?: string;
    };

async function executeAnalysis(
  input: AnalyzeInput,
  startedAt: number,
  userId: string,
  onProgress?: (event: AnalysisProgressPayload) => void | Promise<void>,
): Promise<AnalyzeExecutionResult> {
  let reportId: string | undefined;
  let activeStep: AnalysisProgressPayload["step"] | undefined;

  async function emitProgress(event: AnalysisProgressPayload) {
    activeStep = event.status === "running" ? event.step : undefined;
    await onProgress?.(event);
  }

  try {
    await emitProgress({
      step: "validate-input",
      status: "completed",
      message: "Inputs validated. Provider key will be used only for this analysis request.",
    });

    const prepared = await prepareRepositoryAnalysis({
      repoUrl: input.repoUrl,
      analysisDepth: input.analysisDepth,
      onProgress: emitProgress,
    });

    await emitProgress({
      step: "create-report",
      status: "running",
      message: "Creating a report record for this run.",
    });
    const repository = await upsertRepository({
      owner: prepared.repository.owner,
      name: prepared.repository.name,
      url: prepared.repository.url,
      defaultBranch: prepared.repository.defaultBranch,
    });

    const report = await createReport({
      repositoryId: repository.id,
      provider: input.provider,
      userId,
    });
    const createdReportId = report.id;
    reportId = createdReportId;
    await markReportRunning(createdReportId);
    await emitProgress({
      step: "create-report",
      status: "completed",
      message: "Report record created. Starting specialized review agents.",
      detail: `Report ${createdReportId}`,
    });

    const analysis = await runPreparedRepositoryAnalysis({
      provider: input.provider,
      apiKey: input.apiKey,
      prepared,
      onProgress: emitProgress,
    });

    await emitProgress({
      step: "persist-report",
      status: "running",
      message: "Saving report findings and recommendations.",
    });
    await completeReport({
      reportId: createdReportId,
      report: analysis.report,
      selectedFiles: analysis.selectedFiles,
    });
    await emitProgress({
      step: "persist-report",
      status: "completed",
      message: "Report saved. Opening results.",
    });

    logger.info("analysis.completed", {
      reportId,
      repo: `${analysis.repository.owner}/${analysis.repository.name}`,
      provider: input.provider,
      userId,
      analysisDepth: input.analysisDepth,
      filesSelected: analysis.selectedFiles.length,
      durationMs: Date.now() - startedAt,
    });

    return { ok: true, reportId: createdReportId };
  } catch (error) {
    const appError = toAppError(error);
    const safeMessage = redactApiKey(appError.message);

    if (activeStep) {
      await onProgress?.({
        step: activeStep,
        status: "failed",
        message: safeMessage,
      });
    }

    if (reportId) {
      await failReport(reportId, safeMessage);
    }

    logger.error("analysis.failed", {
      reportId,
      userId,
      failureType: appError.code,
      durationMs: Date.now() - startedAt,
    });

    return {
      ok: false,
      error: {
        code: appError.code,
        message: safeMessage,
        status: appError.status,
      },
      reportId,
    };
  }
}

function createStreamResponse(input: AnalyzeInput, startedAt: number, userId: string) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function send(event: AnalysisProgressEvent) {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      }

      try {
        const result = await executeAnalysis(input, startedAt, userId, (event) => {
          send({ type: "progress", ...event });
        });

        if (result.ok) {
          send({
            type: "complete",
            reportId: result.reportId,
            message: "Report created. Opening results.",
          });
        } else {
          send({
            type: "error",
            code: result.error.code,
            message: result.error.message,
            reportId: result.reportId,
          });
        }
      } catch (error) {
        const appError = toAppError(error);
        send({
          type: "error",
          code: appError.code,
          message: redactApiKey(appError.message),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

function errorResponse(error: unknown, startedAt: number) {
  const appError = toAppError(error);
  const safeMessage = redactApiKey(appError.message);

  logger.error("analysis.failed", {
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
    const wantsStream =
      request.headers.get("accept")?.includes("application/x-ndjson") ||
      request.headers.get("x-repovitals-stream") === "1";

    if (wantsStream) {
      return createStreamResponse(input, startedAt, user.id);
    }

    const result = await executeAnalysis(input, startedAt, user.id);

    if (result.ok) {
      return NextResponse.json({ reportId: result.reportId });
    }

    return NextResponse.json(
      {
        error: {
          code: result.error.code,
          message: result.error.message,
        },
        reportId: result.reportId,
      },
      { status: result.error.status },
    );
  } catch (error) {
    return errorResponse(error, startedAt);
  }
}
