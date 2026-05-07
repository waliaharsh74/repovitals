import { z } from "zod";
import { REPORT_OUTPUT_LIMITS } from "@/lib/ai/tokenBudget";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeArrayInput(value: unknown, maxItems: number): unknown {
  if (Array.isArray(value)) {
    return value.slice(0, maxItems);
  }

  if (!isRecord(value)) {
    return value;
  }

  const preferredArrayKeys = ["items", "recommendations", "findings", "results", "data"];
  for (const key of preferredArrayKeys) {
    if (Array.isArray(value[key])) {
      return value[key].slice(0, maxItems);
    }
  }

  return Object.values(value)
    .flatMap((item) => (Array.isArray(item) ? item : [item]))
    .slice(0, maxItems);
}

function cappedArray<TSchema extends z.ZodTypeAny>(itemSchema: TSchema, maxItems: number) {
  return z.preprocess((value) => normalizeArrayInput(value, maxItems), z.array(itemSchema));
}

export const findingSchema = z.object({
  title: z.string().min(3),
  category: z.enum(["architecture", "security", "performance", "maintainability", "testing"]),
  severity: z.enum(["critical", "high", "medium", "low"]),
  confidence: z.number().min(0).max(1),
  filePath: z.string().optional(),
  lineHint: z.number().int().positive().optional(),
  explanation: z.string().min(10),
  recommendation: z.string().min(10),
  suggestedPatch: z.string().optional(),
});

export const agentReviewSchema = z
  .object({
    summary: z.string().min(20),
    findings: cappedArray(findingSchema, REPORT_OUTPUT_LIMITS.MAX_AGENT_FINDINGS),
    recommendations: cappedArray(
      z.string(),
      REPORT_OUTPUT_LIMITS.MAX_AGENT_RECOMMENDATIONS,
    ).default([]),
  })
  .describe("RepoVitalsAgentReview");

export const architectureReviewSchema = z
  .object({
    summary: z.string().min(20),
    architectureDiagramMermaid: z.string().min(10),
    findings: cappedArray(findingSchema, REPORT_OUTPUT_LIMITS.MAX_AGENT_FINDINGS),
    recommendations: cappedArray(
      z.string(),
      REPORT_OUTPUT_LIMITS.MAX_AGENT_RECOMMENDATIONS,
    ).default([]),
  })
  .describe("RepoVitalsArchitectureReview");

export const reportSynthesisSchema = z
  .object({
    summary: z.string().min(40),
    scorecard: z.object({
      architecture: z.number().int().min(0).max(100),
      security: z.number().int().min(0).max(100),
      performance: z.number().int().min(0).max(100),
      maintainability: z.number().int().min(0).max(100),
      testing: z.number().int().min(0).max(100),
      overall: z.number().int().min(0).max(100),
    }),
    recommendations: cappedArray(z.string(), REPORT_OUTPUT_LIMITS.MAX_REPORT_RECOMMENDATIONS).pipe(
      z.array(z.string()).min(1),
    ),
  })
  .describe("RepoVitalsReportSynthesis");
