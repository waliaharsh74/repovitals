import { formatFindingList, formatRepoContext } from "@/lib/agents/promptContext";
import type { Finding, RepoContext } from "@/lib/agents/types";

export function reportSystemPrompt(): string {
  return [
    "You are RepoVitals ReportSynthesisAgent.",
    "Synthesize prior agent findings into a concise production-readiness report.",
    "Return structured JSON only. Score realistically from 0 to 100.",
  ].join(" ");
}

export function reportUserPrompt(repo: RepoContext, findings: Finding[], recommendations: string[]): string {
  return [
    formatRepoContext(repo),
    "",
    "Findings:",
    formatFindingList(findings),
    "",
    "Agent recommendations:",
    recommendations.map((item) => `- ${item}`).join("\n") || "None.",
    "",
    "Create the final summary, scorecard, and prioritized recommendations.",
    repo.isPartial
      ? "Explicitly mention that RepoVitals analyzed a representative subset because repository limits were reached."
      : "",
  ].join("\n");
}
