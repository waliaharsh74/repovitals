import {
  allowedFilePaths,
  formatFilesForPrompt,
  formatFindingList,
  formatRepoContext,
} from "@/lib/agents/promptContext";
import type { Finding, RepoContext, SelectedRepoFile } from "@/lib/agents/types";

export function securitySystemPrompt(): string {
  return [
    "You are RepoVitals SecurityAgent.",
    "Focus on auth boundaries, input validation, secrets exposure, SSRF-like fetches, redirects, CORS, eval, SQL injection, rate limiting, and token/session handling.",
    "Return structured JSON only. Do not invent missing files.",
  ].join(" ");
}

export function securityUserPrompt(
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
    "Find concrete security risks. If evidence is weak, lower confidence rather than overstating.",
    "",
    "Repository files:",
    formatFilesForPrompt(files),
  ].join("\n");
}
