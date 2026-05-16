import { Worker } from "bullmq";
import {
  ANALYSIS_QUEUE_NAME,
  getAnalysisQueueConcurrency,
  getRedisConnectionOptions,
  type AnalysisQueueJobData,
} from "@/lib/analysis/jobQueue";
import { runAnalysisQueueJob } from "@/lib/analysis/runAnalysisJob";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/utils/logger";

const worker = new Worker<AnalysisQueueJobData>(
  ANALYSIS_QUEUE_NAME,
  async (job) => {
    await runAnalysisQueueJob(job);
  },
  {
    connection: getRedisConnectionOptions(),
    concurrency: getAnalysisQueueConcurrency(),
  },
);

worker.on("ready", () => {
  logger.info("analysis.worker.ready", {
    queue: ANALYSIS_QUEUE_NAME,
    concurrency: getAnalysisQueueConcurrency(),
  });
});

worker.on("failed", (job, error) => {
  logger.error("analysis.worker.failed", {
    queueJobId: job?.id,
    analysisJobId: job?.data.analysisJobId,
    error: error.message,
  });
});

async function shutdown(signal: NodeJS.Signals) {
  logger.info("analysis.worker.shutdown", { signal });
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", (signal) => {
  void shutdown(signal);
});

process.on("SIGTERM", (signal) => {
  void shutdown(signal);
});
