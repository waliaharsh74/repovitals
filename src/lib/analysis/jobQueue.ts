import { Queue, QueueEvents, type ConnectionOptions, type JobsOptions } from "bullmq";

export const ANALYSIS_QUEUE_NAME = "analysis";
export const ANALYSIS_DEAD_LETTER_QUEUE_NAME = "analysis.dead";

export type AnalysisQueueJobData = {
  analysisJobId: string;
};

let analysisQueue: Queue<AnalysisQueueJobData> | undefined;
let deadLetterQueue: Queue | undefined;
let analysisQueueEvents: QueueEvents | undefined;

function parseIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

export function getAnalysisJobAttempts(): number {
  return parseIntegerEnv("ANALYSIS_JOB_ATTEMPTS", 3);
}

export function getAnalysisJobBackoffMs(): number {
  return parseIntegerEnv("ANALYSIS_JOB_BACKOFF_MS", 15_000);
}

export function getAnalysisJobTimeoutMs(): number {
  return parseIntegerEnv("ANALYSIS_JOB_TIMEOUT_MS", 15 * 60 * 1000);
}

export function getAnalysisQueueConcurrency(): number {
  return parseIntegerEnv("ANALYSIS_QUEUE_CONCURRENCY", 1);
}

export function getRedisConnectionOptions(): ConnectionOptions {
  const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
  const parsed = new URL(redisUrl);

  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    db: parsed.pathname.length > 1 ? Number(parsed.pathname.slice(1)) : undefined,
    tls: parsed.protocol === "rediss:" ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}

export function getAnalysisQueue(): Queue<AnalysisQueueJobData> {
  analysisQueue ??= new Queue<AnalysisQueueJobData>(ANALYSIS_QUEUE_NAME, {
    connection: getRedisConnectionOptions(),
  });
  return analysisQueue;
}

export function getAnalysisDeadLetterQueue(): Queue {
  deadLetterQueue ??= new Queue(ANALYSIS_DEAD_LETTER_QUEUE_NAME, {
    connection: getRedisConnectionOptions(),
  });
  return deadLetterQueue;
}

export function getAnalysisQueueEvents(): QueueEvents {
  analysisQueueEvents ??= new QueueEvents(ANALYSIS_QUEUE_NAME, {
    connection: getRedisConnectionOptions(),
  });
  return analysisQueueEvents;
}

export function getAnalysisQueueJobOptions(): JobsOptions {
  return {
    attempts: getAnalysisJobAttempts(),
    backoff: {
      type: "exponential",
      delay: getAnalysisJobBackoffMs(),
    },
    removeOnComplete: {
      age: 60 * 60 * 24,
      count: 500,
    },
    removeOnFail: false,
  };
}
