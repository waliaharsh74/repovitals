import {
  allowedFilePaths,
  formatFilesForPrompt,
  formatFindingList,
  formatRepoContext,
} from "@/lib/agents/promptContext";
import type { Finding, RepoContext, SelectedRepoFile } from "@/lib/agents/types";

export function performanceSystemPrompt(): string {
  return [
    "You are RepoVitals PerformanceAgent.",
    "Review for heavy client components, unnecessary re-renders, missing pagination, blocking API calls, bundle risk, inefficient DB access, missing caching, expensive loops, and N+1 patterns.",
    "Return structured JSON only. Do not invent missing files.",
  ].join(" ");
}

export function performanceUserPrompt(
  repo: RepoContext,
  files: SelectedRepoFile[],
  previousFindings: Finding[],
): string {
  return [
    formatRepoContext(repo),
    "",
    "Allowed file paths:",
    allowedFilePaths(files),
    "",
    "Previous findings for context:",
    formatFindingList(previousFindings),
    "",
    "Find concrete performance and scalability risks with practical fixes.",
    "",
    "Repository files:",
    formatFilesForPrompt(files),
  ].join("\n");
}
