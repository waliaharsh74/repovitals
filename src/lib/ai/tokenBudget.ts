export type AnalysisDepth = "standard" | "expanded";

export type RepoAnalysisLimits = {
  MAX_FILES_TO_FETCH: number;
  MAX_FILE_SIZE_BYTES: number;
  MAX_TOTAL_CHARS: number;
  MAX_FINDINGS: number;
  MAX_AGENT_STEPS: number;
};

export const STANDARD_REPO_ANALYSIS_LIMITS = {
  MAX_FILES_TO_FETCH: 80,
  MAX_FILE_SIZE_BYTES: 80_000,
  MAX_TOTAL_CHARS: 300_000,
  MAX_FINDINGS: 25,
  MAX_AGENT_STEPS: 6,
} as const;

export const EXPANDED_REPO_ANALYSIS_LIMITS = {
  MAX_FILES_TO_FETCH: 140,
  MAX_FILE_SIZE_BYTES: 140_000,
  MAX_TOTAL_CHARS: 450_000,
  MAX_FINDINGS: 40,
  MAX_AGENT_STEPS: 6,
} as const;

export const REPO_ANALYSIS_LIMITS = STANDARD_REPO_ANALYSIS_LIMITS;

export const REPORT_OUTPUT_LIMITS = {
  MAX_AGENT_FINDINGS: 8,
  MAX_AGENT_RECOMMENDATIONS: 10,
  MAX_REPORT_RECOMMENDATIONS: 25,
} as const;

export function getRepoAnalysisLimits(depth: AnalysisDepth = "standard"): RepoAnalysisLimits {
  return depth === "expanded" ? EXPANDED_REPO_ANALYSIS_LIMITS : STANDARD_REPO_ANALYSIS_LIMITS;
}

export function clampPromptContent(content: string, maxChars: number): string {
  if (content.length <= maxChars) {
    return content;
  }

  return `${content.slice(0, maxChars)}\n\n[RepoVitals truncated this file for cost safety.]`;
}
