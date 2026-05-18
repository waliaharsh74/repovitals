import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { runAgentPipeline } from "@/lib/agents/AgentPipeline";
import type { AIProvider, GenerateObjectInput } from "@/lib/ai/providers/AIProvider";
import type { Finding, RepoContext, SelectedRepoFile } from "@/lib/agents/types";

const repo: RepoContext = {
  owner: "owner",
  name: "repo",
  normalizedUrl: "https://github.com/owner/repo",
  defaultBranch: "main",
  analyzedFileCount: 2,
  selectedFileCount: 1,
  totalSelectedChars: 42,
  isPartial: false,
};

const files: SelectedRepoFile[] = [
  {
    path: "src/app.ts",
    language: "TypeScript",
    size: 42,
    reason: "Source file",
    content: "export const app = true;",
  },
];

function finding(category: Finding["category"]): Finding {
  return {
    title: `${category} issue`,
    category,
    severity: "medium",
    confidence: 0.8,
    filePath: "src/app.ts",
    explanation: `Concrete ${category} explanation.`,
    recommendation: `Concrete ${category} recommendation.`,
  };
}

function createProvider(calls: string[]): AIProvider {
  return {
    name: "test-provider",
    async generateText() {
      return "";
    },
    async generateObject<TSchema extends z.ZodTypeAny>(
      input: GenerateObjectInput<TSchema>,
    ): Promise<z.infer<TSchema>> {
      calls.push(input.system);

      if (input.system.includes("ArchitectureAgent")) {
        return {
          summary: "Architecture review summary with enough detail.",
          architectureDiagramMermaid: "flowchart TD\nA-->B",
          findings: [finding("architecture")],
          recommendations: ["Tighten architecture boundaries."],
        } as z.infer<TSchema>;
      }

      if (input.system.includes("SecurityAgent")) {
        return {
          summary: "Security review summary with enough detail.",
          findings: [finding("security")],
          recommendations: ["Harden security boundaries."],
        } as z.infer<TSchema>;
      }

      if (input.system.includes("PerformanceAgent")) {
        return {
          summary: "Performance review summary with enough detail.",
          findings: [finding("performance")],
          recommendations: ["Reduce unnecessary work."],
        } as z.infer<TSchema>;
      }

      if (input.system.includes("TestingAgent")) {
        return {
          summary: "Testing review summary with enough detail.",
          findings: [finding("testing")],
          recommendations: ["Add critical-path tests."],
        } as z.infer<TSchema>;
      }

      return {
        summary: "Final production-readiness summary with enough detail for the report.",
        scorecard: {
          overall: 72,
          architecture: 70,
          security: 68,
          performance: 75,
          maintainability: 71,
          testing: 65,
        },
        recommendations: ["Address the selected-agent findings first."],
      } as z.infer<TSchema>;
    },
  };
}

describe("runAgentPipeline", () => {
  it("runs only selected review agents plus required classifier and synthesis steps", async () => {
    const calls: string[] = [];

    const report = await runAgentPipeline({
      provider: createProvider(calls),
      repo,
      files,
      selectedAgentIds: ["security", "testing"],
    });

    expect(calls.some((system) => system.includes("SecurityAgent"))).toBe(true);
    expect(calls.some((system) => system.includes("TestingAgent"))).toBe(true);
    expect(calls.some((system) => system.includes("ArchitectureAgent"))).toBe(false);
    expect(calls.some((system) => system.includes("PerformanceAgent"))).toBe(false);
    expect(calls.some((system) => system.includes("ReportSynthesisAgent"))).toBe(true);
    expect(report.agentTrace.map((step) => step.agent)).toEqual([
      "FileClassifierAgent",
      "SecurityAgent",
      "TestingAgent",
      "ReportSynthesisAgent",
    ]);
    expect(report.findings.map((item) => item.category)).toEqual(["security", "testing"]);
  });
});
