import { NextResponse } from "next/server";
import { getAnalysisQueue } from "@/lib/analysis/jobQueue";
import {
  cancelAnalysisJob,
  getAnalysisJobQueueIdentity,
} from "@/lib/db/analysisJobs";
import { getCurrentUser } from "@/lib/auth/session";
import { logger } from "@/lib/utils/logger";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Sign in to cancel analysis jobs.",
        },
      },
      { status: 401 },
    );
  }

  const { jobId } = await context.params;
  const queueIdentity = await getAnalysisJobQueueIdentity({ jobId, userId: user.id });

  if (!queueIdentity) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Analysis job not found." } },
      { status: 404 },
    );
  }

  const job = await cancelAnalysisJob({ jobId, userId: user.id });

  if (queueIdentity.queueJobId) {
    try {
      const queueJob = await getAnalysisQueue().getJob(queueIdentity.queueJobId);
      const state = queueJob ? await queueJob.getState() : null;
      const removableStates = new Set(["waiting", "delayed", "prioritized", "waiting-children"]);
      if (queueJob && state && removableStates.has(String(state))) {
        await queueJob.remove();
      }
    } catch (error) {
      logger.error("analysis.cancel_queue_remove_failed", {
        jobId,
        queueJobId: queueIdentity.queueJobId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return NextResponse.json({
    jobId,
    reportId: queueIdentity.reportId,
    status: job?.status ?? queueIdentity.status,
  });
}
