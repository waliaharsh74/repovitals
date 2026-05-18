import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getAnalysisJobSnapshot } from "@/lib/db/analysisJobs";
import type { AnalysisProgressEvent } from "@/lib/analysis/progress";
import { getAnalysisQueue } from "@/lib/analysis/jobQueue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLL_MS = 1_000;
const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);

function encodeSse(event: string, data: AnalysisProgressEvent): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

async function getPendingSnapshotMessage(errorMessage?: string | null) {
  if (errorMessage) {
    return errorMessage;
  }

  try {
    const workerCount = await getAnalysisQueue().getWorkersCount();
    if (workerCount === 0) {
      return "Analysis queued, but no analysis worker is currently connected.";
    }
  } catch {
    return undefined;
  }

  return "Analysis queued. Waiting for the worker...";
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
  let closeCurrentStream: (() => void) | undefined;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let pollTimer: ReturnType<typeof setTimeout> | undefined;
      closeCurrentStream = closeStream;

      function clearPollTimer() {
        if (pollTimer) {
          clearTimeout(pollTimer);
          pollTimer = undefined;
        }
      }

      function markClosed() {
        closed = true;
        clearPollTimer();
        request.signal.removeEventListener("abort", closeStream);
      }

      function closeStream() {
        if (closed) {
          return;
        }

        markClosed();
        try {
          controller.close();
        } catch {
          // The runtime may already have closed the controller after a client disconnect.
        }
      }

      function send(event: string, data: AnalysisProgressEvent) {
        if (closed || request.signal.aborted) {
          closeStream();
          return false;
        }

        try {
          controller.enqueue(encoder.encode(encodeSse(event, data)));
          return true;
        } catch {
          markClosed();
          return false;
        }
      }

      function scheduleTick(delayMs: number) {
        if (closed || request.signal.aborted) {
          closeStream();
          return;
        }

        clearPollTimer();
        pollTimer = setTimeout(() => {
          pollTimer = undefined;
          void tick();
        }, delayMs);
      }

      async function tick() {
        try {
          if (closed || request.signal.aborted) {
            closeStream();
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
            closeStream();
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
              selectedAgentIds: snapshot.selectedAgentIds,
              steps: snapshot.progress,
              message:
                snapshot.status === "pending"
                  ? await getPendingSnapshotMessage(snapshot.errorMessage)
                  : snapshot.errorMessage ?? undefined,
            });
          }

          if (snapshot.status === "completed") {
            send("complete", {
              type: "complete",
              jobId: snapshot.jobId,
              reportId: snapshot.reportId,
              message: "Report created. Opening results.",
            });
            closeStream();
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
            closeStream();
            return;
          }

          scheduleTick(POLL_MS);
        } catch (error) {
          send("job-error", {
            type: "error",
            jobId,
            code: "ANALYSIS_FAILED",
            message: error instanceof Error ? error.message : "Could not stream analysis progress.",
          });
          closeStream();
        }
      }

      request.signal.addEventListener("abort", closeStream, { once: true });

      const initialMessage =
        initialSnapshot.status === "pending"
          ? await getPendingSnapshotMessage(initialSnapshot.errorMessage)
          : initialSnapshot.errorMessage ?? undefined;

      if (!send("snapshot", {
        type: "snapshot",
        jobId: initialSnapshot.jobId,
        reportId: initialSnapshot.reportId,
        status: initialSnapshot.status,
        selectedAgentIds: initialSnapshot.selectedAgentIds,
        steps: initialSnapshot.progress,
        message: initialMessage,
      })) {
        return;
      }
      lastProgressFingerprint = JSON.stringify(initialSnapshot.progress);
      lastStatus = initialSnapshot.status;

      if (TERMINAL_STATUSES.has(initialSnapshot.status)) {
        scheduleTick(0);
        return;
      }

      scheduleTick(POLL_MS);
    },
    cancel() {
      closeCurrentStream?.();
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
