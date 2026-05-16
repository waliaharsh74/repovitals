import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getAnalysisJobSnapshot } from "@/lib/db/analysisJobs";
import type { AnalysisProgressEvent } from "@/lib/analysis/progress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLL_MS = 1_000;
const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);

function encodeSse(event: string, data: AnalysisProgressEvent): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Sign in to stream analysis progress.",
        },
      },
      { status: 401 },
    );
  }

  const { jobId } = await context.params;
  const userId = user.id;
  const initialSnapshot = await getAnalysisJobSnapshot({ jobId, userId });

  if (!initialSnapshot) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Analysis job not found." } },
      { status: 404 },
    );
  }

  const encoder = new TextEncoder();
  let lastProgressFingerprint = "";
  let lastStatus = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;

      function send(event: string, data: AnalysisProgressEvent) {
        controller.enqueue(encoder.encode(encodeSse(event, data)));
      }

      async function tick() {
        try {
          if (closed || request.signal.aborted) {
            closed = true;
            controller.close();
            return;
          }

          const snapshot = await getAnalysisJobSnapshot({ jobId, userId });
          if (!snapshot) {
            send("job-error", {
              type: "error",
              jobId,
              code: "NOT_FOUND",
              message: "Analysis job not found.",
            });
            closed = true;
            controller.close();
            return;
          }

          const fingerprint = JSON.stringify(snapshot.progress);
          if (fingerprint !== lastProgressFingerprint || snapshot.status !== lastStatus) {
            lastProgressFingerprint = fingerprint;
            lastStatus = snapshot.status;
            send("snapshot", {
              type: "snapshot",
              jobId: snapshot.jobId,
              reportId: snapshot.reportId,
              status: snapshot.status,
              steps: snapshot.progress,
              message: snapshot.errorMessage ?? undefined,
            });
          }

          if (snapshot.status === "completed") {
            send("complete", {
              type: "complete",
              jobId: snapshot.jobId,
              reportId: snapshot.reportId,
              message: "Report created. Opening results.",
            });
            closed = true;
            controller.close();
            return;
          }

          if (snapshot.status === "failed" || snapshot.status === "cancelled") {
            send("job-error", {
              type: "error",
              jobId: snapshot.jobId,
              reportId: snapshot.reportId,
              code: snapshot.errorCode ?? (snapshot.status === "cancelled" ? "ANALYSIS_CANCELLED" : "ANALYSIS_FAILED"),
              message:
                snapshot.errorMessage ??
                (snapshot.status === "cancelled" ? "Analysis was cancelled." : "Analysis failed."),
            });
            closed = true;
            controller.close();
            return;
          }

          setTimeout(() => {
            void tick();
          }, POLL_MS);
        } catch (error) {
          send("job-error", {
            type: "error",
            jobId,
            code: "ANALYSIS_FAILED",
            message: error instanceof Error ? error.message : "Could not stream analysis progress.",
          });
          closed = true;
          controller.close();
        }
      }

      send("snapshot", {
        type: "snapshot",
        jobId: initialSnapshot.jobId,
        reportId: initialSnapshot.reportId,
        status: initialSnapshot.status,
        steps: initialSnapshot.progress,
        message: initialSnapshot.errorMessage ?? undefined,
      });
      lastProgressFingerprint = JSON.stringify(initialSnapshot.progress);
      lastStatus = initialSnapshot.status;

      if (TERMINAL_STATUSES.has(initialSnapshot.status)) {
        setTimeout(() => {
          void tick();
        }, 0);
        return;
      }

      setTimeout(() => {
        void tick();
      }, POLL_MS);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
