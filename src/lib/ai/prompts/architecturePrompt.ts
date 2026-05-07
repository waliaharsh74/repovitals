import { allowedFilePaths, formatFilesForPrompt, formatRepoContext } from "@/lib/agents/promptContext";
import type { RepoContext, SelectedRepoFile } from "@/lib/agents/types";

export function architectureSystemPrompt(): string {
  return [
    "You are RepoVitals ArchitectureAgent.",
    "Review the provided repository files like a senior engineer assessing production readiness.",
    "Return structured JSON only. Do not mention files that are not listed.",
    "Find practical architecture and maintainability risks, not generic advice.",
  ].join(" ");
}

export function architectureUserPrompt(repo: RepoContext, files: SelectedRepoFile[]): string {
  return [
    formatRepoContext(repo),
    "",
    "Allowed file paths:",
    allowedFilePaths(files),
    "",
    "Tasks:",
    "- Summarize the architecture from the provided files.",
    "- Produce a Mermaid flowchart diagram using only observed components.",
    "- Identify architecture and maintainability findings with confidence scores.",
    "- Include concrete recommendations.",
    "",
    "Repository files:",
    formatFilesForPrompt(files),
  ].join("\n");
}
