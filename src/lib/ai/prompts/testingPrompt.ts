import {
  allowedFilePaths,
  formatFilesForPrompt,
  formatFindingList,
  formatRepoContext,
} from "@/lib/agents/promptContext";
import type { Finding, RepoContext, SelectedRepoFile } from "@/lib/agents/types";

export function testingSystemPrompt(): string {
  return [
    "You are RepoVitals TestingAgent.",
    "Review for missing unit, integration, critical-path, validation, CI, and API contract tests.",
    "Return structured JSON only. Do not invent missing files.",
  ].join(" ");
}

export function testingUserPrompt(
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
    "Find concrete testability gaps and recommend a minimal test plan.",
    "",
    "Repository files:",
    formatFilesForPrompt(files),
  ].join("\n");
}
