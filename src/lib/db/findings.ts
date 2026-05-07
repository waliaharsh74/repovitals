import type { Finding } from "@/lib/agents/types";

export function findingToCreateManyInput(finding: Finding) {
  return {
    title: finding.title,
    category: finding.category,
    severity: finding.severity,
    confidence: finding.confidence,
    filePath: finding.filePath,
    lineHint: finding.lineHint,
    explanation: finding.explanation,
    recommendation: finding.recommendation,
    suggestedPatch: finding.suggestedPatch,
  };
}
