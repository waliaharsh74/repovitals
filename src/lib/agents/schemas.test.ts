import { describe, expect, it } from "vitest";
import { REPORT_OUTPUT_LIMITS } from "@/lib/ai/tokenBudget";
import { findingSchema, reportSynthesisSchema } from "@/lib/agents/schemas";

const baseFinding = {
  title: "Missing request timeout",
  category: "performance",
  severity: "medium",
  confidence: 0.8,
  filePath: "src/app/api/analyze/route.ts",
  explanation: "The request path can wait indefinitely for an upstream service.",
  recommendation: "Add a bounded timeout and expose a retryable failure to callers.",
} as const;

describe("reportSynthesisSchema", () => {
  it("caps oversized recommendation arrays instead of failing validation", () => {
    const parsed = reportSynthesisSchema.parse({
      summary: "This repository has several production-readiness risks that should be prioritized.",
      scorecard: {
        architecture: 70,
        security: 65,
        performance: 75,
        maintainability: 70,
        testing: 55,
        overall: 67,
      },
      recommendations: Array.from(
        { length: REPORT_OUTPUT_LIMITS.MAX_REPORT_RECOMMENDATIONS + 5 },
        (_, index) => `Recommendation ${index + 1}`,
      ),
    });

    expect(parsed.recommendations).toHaveLength(REPORT_OUTPUT_LIMITS.MAX_REPORT_RECOMMENDATIONS);
  });

  it("accepts recommendation objects returned by providers", () => {
    const parsed = reportSynthesisSchema.parse({
      summary: "This repository has several production-readiness risks that should be prioritized.",
      scorecard: {
        architecture: 70,
        security: 65,
        performance: 75,
        maintainability: 70,
        testing: 55,
        overall: 67,
      },
      recommendations: {
        security: [
          "Validate external inputs before fetching repository resources.",
          "Keep OpenAI keys scoped to a single request and redact them from logs.",
        ],
        testing: "Add integration tests for the analysis API failure paths.",
      },
    });

    expect(parsed.recommendations).toEqual([
      "Validate external inputs before fetching repository resources.",
      "Keep OpenAI keys scoped to a single request and redact them from logs.",
      "Add integration tests for the analysis API failure paths.",
    ]);
  });
});

describe("findingSchema", () => {
  it("normalizes model lineHint zero to an absent optional line hint", () => {
    const parsed = findingSchema.parse({
      ...baseFinding,
      lineHint: 0,
    });

    expect(parsed.lineHint).toBeUndefined();
  });

  it("accepts positive lineHint strings from model JSON", () => {
    const parsed = findingSchema.parse({
      ...baseFinding,
      lineHint: "42",
    });

    expect(parsed.lineHint).toBe(42);
  });

  it("still rejects invalid non-numeric lineHint values", () => {
    expect(() =>
      findingSchema.parse({
        ...baseFinding,
        lineHint: "unknown",
      }),
    ).toThrow();
  });
});
