import { parseGithubUrl } from "@/lib/github/parseGithubUrl";
import { prisma } from "@/lib/db/prisma";
import {
  getAnalysisJobAttempts,
  getAnalysisJobTimeoutMs,
} from "@/lib/analysis/jobQueue";
import {
  decryptAnalysisSecret,
  encryptAnalysisSecret,
} from "@/lib/analysis/jobSecrets";
import type {
  AnalysisJobStatus,
  AnalysisProgressPayload,
  AnalysisProgressRecord,
  AnalysisWorkflowStepId,
} from "@/lib/analysis/progress";
import type { AnalysisDepth } from "@/lib/ai/tokenBudget";
import type { AIProviderName } from "@/lib/agents/types";
import {
  AnalysisCancelledError,
  AnalysisFailedError,
  AnalysisTimeoutError,
} from "@/lib/utils/errors";

type ProgressRow = {
  step: string;
  status: string;
  message: string;
  detail: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
  updatedAt: Date;
};

export type AnalysisJobWorkerRecord = {
  id: string;
  reportId: string;
  userId: string | null;
  repoUrl: string;
  provider: AIProviderName;
  analysisDepth: AnalysisDepth;
  apiKey: string;
  attempt: number;
  maxAttempts: number;
  timeoutMs: number;
  deadlineAt: Date | null;
};

function nullableIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function toProgressRecord(row: ProgressRow): AnalysisProgressRecord {
  return {
    step: row.step as AnalysisWorkflowStepId,
    status: row.status as AnalysisProgressRecord["status"],
    message: row.message,
    detail: row.detail,
    startedAt: nullableIso(row.startedAt),
    completedAt: nullableIso(row.completedAt),
    failedAt: nullableIso(row.failedAt),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createPendingAnalysisJob(input: {
  userId: string;
  repoUrl: string;
  provider: AIProviderName;
  apiKey: string;
  analysisDepth: AnalysisDepth;
}) {
  const parsed = parseGithubUrl(input.repoUrl);
  const encryptedApiKey = encryptAnalysisSecret(input.apiKey);
  const now = new Date();
  const maxAttempts = getAnalysisJobAttempts();
  const timeoutMs = getAnalysisJobTimeoutMs();

  return prisma.$transaction(async (tx) => {
    const repository = await tx.repository.upsert({
      where: {
        owner_name: {
          owner: parsed.owner,
          name: parsed.repo,
        },
      },
      create: {
        owner: parsed.owner,
        name: parsed.repo,
        url: parsed.normalizedUrl,
      },
      update: {
        url: parsed.normalizedUrl,
      },
    });

    const report = await tx.analysisReport.create({
      data: {
        repositoryId: repository.id,
        userId: input.userId,
        provider: input.provider,
        status: "pending",
      },
    });

    const job = await tx.analysisJob.create({
      data: {
        reportId: report.id,
        userId: input.userId,
        repoUrl: parsed.normalizedUrl,
        provider: input.provider,
        analysisDepth: input.analysisDepth,
        encryptedApiKey,
        status: "pending",
        maxAttempts,
        timeoutMs,
        progress: {
          createMany: {
            data: [
              {
                step: "validate-input",
                status: "completed",
                message: "Inputs validated. Provider key was encrypted for this queued analysis job.",
                completedAt: now,
              },
              {
                step: "create-report",
                status: "completed",
                message: "Pending report and analysis job created.",
                detail: `Report ${report.id}`,
                completedAt: now,
              },
            ],
          },
        },
      },
    });

    return {
      jobId: job.id,
      reportId: report.id,
      status: job.status as AnalysisJobStatus,
    };
  });
}

export async function setAnalysisJobQueueJobId(jobId: string, queueJobId: string) {
  return prisma.analysisJob.update({
    where: { id: jobId },
    data: { queueJobId },
  });
}

export async function markAnalysisJobEnqueueFailed(jobId: string, message: string) {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const job = await tx.analysisJob.findUnique({ where: { id: jobId } });
    if (!job) {
      throw new AnalysisFailedError("Analysis job was not found.");
    }

    await tx.analysisJob.updateMany({
      where: { id: jobId, status: "pending" },
      data: {
        status: "failed",
        failedAt: now,
        errorCode: "QUEUE_UNAVAILABLE",
        errorMessage: message,
        encryptedApiKey: null,
      },
    });

    await tx.analysisReport.updateMany({
      where: { id: job.reportId, status: "pending" },
      data: {
        status: "failed",
        errorMessage: message,
      },
    });
  });
}

export async function startAnalysisJob(jobId: string, attempt: number): Promise<AnalysisJobWorkerRecord> {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const existing = await tx.analysisJob.findUnique({ where: { id: jobId } });
    if (!existing) {
      throw new AnalysisFailedError("Analysis job was not found.");
    }

    if (existing.status === "cancelled") {
      throw new AnalysisCancelledError();
    }

    if (existing.status === "completed") {
      throw new AnalysisFailedError("Analysis job is already completed.");
    }

    if (existing.status === "failed") {
      throw new AnalysisFailedError("Analysis job has already failed.");
    }

    const deadlineAt = new Date(now.getTime() + existing.timeoutMs);
    const transition = await tx.analysisJob.updateMany({
      where: {
        id: jobId,
        status: { in: ["pending", "running"] },
        cancelledAt: null,
      },
      data: {
        status: "running",
        attempt,
        startedAt: existing.startedAt ?? now,
        deadlineAt,
        lastHeartbeatAt: now,
        errorCode: null,
        errorMessage: null,
      },
    });

    if (transition.count === 0) {
      throw new AnalysisCancelledError();
    }

    await tx.analysisReport.updateMany({
      where: { id: existing.reportId, status: "pending" },
      data: { status: "running", errorMessage: null },
    });

    const job = await tx.analysisJob.findUniqueOrThrow({ where: { id: jobId } });
    if (!job.encryptedApiKey) {
      throw new AnalysisFailedError("Analysis job credential is no longer available.");
    }

    return {
      id: job.id,
      reportId: job.reportId,
      userId: job.userId,
      repoUrl: job.repoUrl,
      provider: job.provider as AIProviderName,
      analysisDepth: job.analysisDepth as AnalysisDepth,
      apiKey: decryptAnalysisSecret(job.encryptedApiKey),
      attempt: job.attempt,
      maxAttempts: job.maxAttempts,
      timeoutMs: job.timeoutMs,
      deadlineAt: job.deadlineAt,
    };
  });
}

export async function markAnalysisJobRetrying(input: {
  jobId: string;
  attempt: number;
  errorCode: string;
  errorMessage: string;
}) {
  await prisma.analysisJob.updateMany({
    where: { id: input.jobId, status: "running" },
    data: {
      status: "pending",
      attempt: input.attempt,
      deadlineAt: null,
      lastHeartbeatAt: new Date(),
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
    },
  });
}

export async function completeAnalysisJob(jobId: string) {
  const now = new Date();
  const transition = await prisma.analysisJob.updateMany({
    where: { id: jobId, status: "running" },
    data: {
      status: "completed",
      completedAt: now,
      deadlineAt: null,
      lastHeartbeatAt: now,
      encryptedApiKey: null,
      errorCode: null,
      errorMessage: null,
    },
  });

  const job = await prisma.analysisJob.findUnique({ where: { id: jobId } });
  if (!job) {
    throw new AnalysisFailedError("Analysis job was not found.");
  }

  if (transition.count === 0 && job.status !== "completed") {
    throw new AnalysisFailedError(`Analysis job ${jobId} cannot transition from ${job.status} to completed.`);
  }

  return job;
}

export async function failAnalysisJob(input: {
  jobId: string;
  errorCode: string;
  errorMessage: string;
  deadLetter?: boolean;
}) {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const job = await tx.analysisJob.findUnique({ where: { id: input.jobId } });
    if (!job) {
      throw new AnalysisFailedError("Analysis job was not found.");
    }

    await tx.analysisJob.updateMany({
      where: { id: input.jobId, status: { in: ["pending", "running"] } },
      data: {
        status: "failed",
        failedAt: now,
        deadLetteredAt: input.deadLetter ? now : job.deadLetteredAt,
        deadlineAt: null,
        lastHeartbeatAt: now,
        encryptedApiKey: null,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
      },
    });

    await tx.analysisReport.updateMany({
      where: { id: job.reportId, status: { in: ["pending", "running"] } },
      data: {
        status: "failed",
        errorMessage: input.errorMessage,
      },
    });

    await tx.analysisJobProgress.updateMany({
      where: { jobId: input.jobId, status: "running" },
      data: {
        status: "failed",
        message: input.errorMessage,
        failedAt: now,
      },
    });

    return tx.analysisJob.findUniqueOrThrow({ where: { id: input.jobId } });
  });
}

export async function cancelAnalysisJob(input: {
  jobId: string;
  userId: string;
  reason?: string;
}) {
  const now = new Date();
  const message = input.reason ?? "Analysis was cancelled.";

  return prisma.$transaction(async (tx) => {
    const job = await tx.analysisJob.findFirst({
      where: { id: input.jobId, userId: input.userId },
    });
    if (!job) {
      return null;
    }

    await tx.analysisJob.updateMany({
      where: { id: input.jobId, status: { in: ["pending", "running"] } },
      data: {
        status: "cancelled",
        cancelledAt: now,
        deadlineAt: null,
        lastHeartbeatAt: now,
        encryptedApiKey: null,
        errorCode: "ANALYSIS_CANCELLED",
        errorMessage: message,
      },
    });

    await tx.analysisReport.updateMany({
      where: { id: job.reportId, status: { in: ["pending", "running"] } },
      data: {
        status: "failed",
        errorMessage: message,
      },
    });

    await tx.analysisJobProgress.updateMany({
      where: { jobId: input.jobId, status: "running" },
      data: {
        status: "failed",
        message,
        failedAt: now,
      },
    });

    return tx.analysisJob.findUniqueOrThrow({ where: { id: input.jobId } });
  });
}

export async function assertAnalysisJobActive(jobId: string) {
  const job = await prisma.analysisJob.findUnique({
    where: { id: jobId },
    select: {
      status: true,
      deadlineAt: true,
    },
  });

  if (!job) {
    throw new AnalysisFailedError("Analysis job was not found.");
  }

  if (job.status === "cancelled") {
    throw new AnalysisCancelledError();
  }

  if (job.deadlineAt && job.deadlineAt.getTime() <= Date.now()) {
    throw new AnalysisTimeoutError();
  }

  if (job.status !== "running") {
    throw new AnalysisFailedError(`Analysis job is ${job.status}.`);
  }
}

export async function heartbeatAnalysisJob(jobId: string) {
  await prisma.analysisJob.updateMany({
    where: { id: jobId, status: "running" },
    data: { lastHeartbeatAt: new Date() },
  });
}

export async function persistAnalysisProgress(
  jobId: string,
  event: AnalysisProgressPayload,
): Promise<AnalysisProgressRecord> {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const existing = await tx.analysisJobProgress.findUnique({
      where: {
        jobId_step: {
          jobId,
          step: event.step,
        },
      },
    });

    const row = await tx.analysisJobProgress.upsert({
      where: {
        jobId_step: {
          jobId,
          step: event.step,
        },
      },
      create: {
        jobId,
        step: event.step,
        status: event.status,
        message: event.message,
        detail: event.detail,
        startedAt: event.status === "running" ? now : null,
        completedAt: event.status === "completed" ? now : null,
        failedAt: event.status === "failed" ? now : null,
      },
      update: {
        status: event.status,
        message: event.message,
        detail: event.detail,
        startedAt: event.status === "running" ? existing?.startedAt ?? now : existing?.startedAt,
        completedAt: event.status === "completed" ? now : existing?.completedAt,
        failedAt: event.status === "failed" ? now : existing?.failedAt,
      },
    });

    await tx.analysisJob.updateMany({
      where: { id: jobId, status: "running" },
      data: { lastHeartbeatAt: now },
    });

    return toProgressRecord(row);
  });
}

export async function getAnalysisJobSnapshot(input: { jobId: string; userId: string }) {
  const job = await prisma.analysisJob.findFirst({
    where: {
      id: input.jobId,
      userId: input.userId,
    },
    include: {
      progress: {
        orderBy: [{ createdAt: "asc" }, { updatedAt: "asc" }],
      },
    },
  });

  if (!job) {
    return null;
  }

  return {
    jobId: job.id,
    reportId: job.reportId,
    status: job.status as AnalysisJobStatus,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    queueJobId: job.queueJobId,
    progress: job.progress.map(toProgressRecord),
  };
}

export async function getAnalysisJobQueueIdentity(input: { jobId: string; userId: string }) {
  return prisma.analysisJob.findFirst({
    where: {
      id: input.jobId,
      userId: input.userId,
    },
    select: {
      id: true,
      queueJobId: true,
      status: true,
      reportId: true,
    },
  });
}
