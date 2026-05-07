import { redactApiKey } from "@/lib/ai/redact";

type LogLevel = "info" | "warn" | "error";

type LogPayload = Record<string, unknown>;

function write(level: LogLevel, event: string, payload: LogPayload = {}) {
  const safePayload = JSON.parse(redactApiKey(payload)) as LogPayload;
  const entry = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...safePayload,
  };

  if (level === "error") {
    console.error(entry);
    return;
  }

  if (level === "warn") {
    console.warn(entry);
    return;
  }

  console.info(entry);
}

export const logger = {
  info: (event: string, payload?: LogPayload) => write("info", event, payload),
  warn: (event: string, payload?: LogPayload) => write("warn", event, payload),
  error: (event: string, payload?: LogPayload) => write("error", event, payload),
};
