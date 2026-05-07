import { clampPromptContent } from "@/lib/ai/tokenBudget";
import type { Finding, RepoContext, SelectedRepoFile } from "@/lib/agents/types";

const MAX_FILE_CHARS_IN_PROMPT = 18_000;

export function formatRepoContext(repo: RepoContext): string {
  return [
    `Repository: ${repo.owner}/${repo.name}`,
    `URL: ${repo.normalizedUrl}`,
    `Default branch: ${repo.defaultBranch}`,
    `Selected files: ${repo.selectedFileCount}`,
    `Analyzed files available from tree: ${repo.analyzedFileCount}`,
    `Partial analysis: ${repo.isPartial ? "yes" : "no"}`,
  ].join("\n");
}

export function formatFilesForPrompt(files: SelectedRepoFile[]): string {
  return files
    .map((file, index) => {
      const content = clampPromptContent(file.content, MAX_FILE_CHARS_IN_PROMPT);
      return [
        `FILE ${index + 1}: ${file.path}`,
        `Language: ${file.language}`,
        `Size: ${file.size}`,
        `Selection reason: ${file.reason}`,
        "```",
        content,
        "```",
      ].join("\n");
    })
    .join("\n\n");
}

export function formatFindingList(findings: Finding[]): string {
  if (findings.length === 0) {
    return "No previous findings.";
  }

  return findings
    .map(
      (finding, index) =>
        `${index + 1}. [${finding.severity}/${finding.category}/${finding.confidence}] ${finding.title} - ${
          finding.filePath ?? "repo-wide"
        }: ${finding.explanation}`,
    )
    .join("\n");
}

export function allowedFilePaths(files: SelectedRepoFile[]): string {
  return files.map((file) => `- ${file.path}`).join("\n");
}
