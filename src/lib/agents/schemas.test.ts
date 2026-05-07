import { describe, expect, it } from "vitest";
import { REPORT_OUTPUT_LIMITS } from "@/lib/ai/tokenBudget";
import { reportSynthesisSchema } from "@/lib/agents/schemas";

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
          "Keep provider keys scoped to a single request and redact them from logs.",
        ],
        testing: "Add integration tests for the analysis API failure paths.",
      },
    });

    expect(parsed.recommendations).toEqual([
      "Validate external inputs before fetching repository resources.",
      "Keep provider keys scoped to a single request and redact them from logs.",
      "Add integration tests for the analysis API failure paths.",
    ]);
  });
});
