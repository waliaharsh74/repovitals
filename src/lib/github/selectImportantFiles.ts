import { createHash } from "node:crypto";
import { REPO_ANALYSIS_LIMITS, type RepoAnalysisLimits } from "@/lib/ai/tokenBudget";
import type { SelectedFileMetadata, SelectedRepoFile } from "@/lib/agents/types";
import { detectLanguage } from "@/lib/github/detectLanguage";
import type { GithubTreeItem } from "@/lib/github/githubClient";

export type CandidateRepoFile = {
  path: string;
  size: number;
  sha?: string;
};

export type SelectedFileCandidate = CandidateRepoFile & {
  language: string;
  reason: string;
  priority: number;
};

const IGNORED_SEGMENTS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "coverage",
  ".cache",
  "turbo",
  ".vercel",
]);

const IGNORED_FILES = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lockb",
]);

const IGNORED_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".ico",
  ".pdf",
  ".zip",
  ".tar",
  ".gz",
  ".mp4",
  ".mov",
  ".mp3",
  ".woff",
  ".woff2",
  ".ttf",
];

function isIgnored(path: string): boolean {
  const lower = path.toLowerCase();
  const name = lower.split("/").at(-1) ?? lower;

  if (IGNORED_FILES.has(name)) {
    return true;
  }

  if (IGNORED_EXTENSIONS.some((extension) => lower.endsWith(extension))) {
    return true;
  }

  return lower.split("/").some((segment) => IGNORED_SEGMENTS.has(segment));
}

function priorityFor(path: string): { priority: number; reason: string } {
  const lower = path.toLowerCase();
  const name = lower.split("/").at(-1) ?? lower;

  if (name === "readme.md") return { priority: 1000, reason: "Primary project documentation." };
  if (name === "package.json") return { priority: 980, reason: "Dependency and script manifest." };
  if (name === "pnpm-workspace.yaml") return { priority: 960, reason: "Workspace topology." };
  if (name === "turbo.json") return { priority: 950, reason: "Build orchestration configuration." };
  if (name === "tsconfig.json") return { priority: 930, reason: "TypeScript project configuration." };
  if (lower === "prisma/schema.prisma") return { priority: 920, reason: "Database schema." };
  if (name.startsWith("next.config")) return { priority: 910, reason: "Next.js runtime configuration." };
  if (name.startsWith("vite.config")) return { priority: 900, reason: "Frontend build configuration." };
  if (lower.includes(".github/workflows/")) return { priority: 890, reason: "CI workflow configuration." };
  if (/(^|\/)(middleware)\.(ts|js)$/.test(lower)) return { priority: 870, reason: "Request middleware boundary." };
  if (/(^|\/)(app|src\/app|pages|api|routes|controllers|server)\//.test(lower)) {
    return { priority: 820, reason: "Application route or server boundary." };
  }
  if (/(^|\/)(services|lib|db|models)\//.test(lower)) {
    return { priority: 780, reason: "Core application service or shared library." };
  }
  if (/(^|\/)(tests?|__tests__)\//.test(lower) || /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(lower)) {
    return { priority: 740, reason: "Test coverage signal." };
  }
  if (/\.(ts|tsx|js|jsx|py|go|rs|java|rb|php|cs)$/.test(lower)) {
    return { priority: 650, reason: "Source file likely to reveal implementation risks." };
  }
  if (/\.(json|yaml|yml|toml|md)$/.test(lower)) {
    return { priority: 540, reason: "Configuration or documentation context." };
  }

  return { priority: 100, reason: "Representative repository file." };
}

export function selectImportantFileCandidates(
  tree: GithubTreeItem[],
  limits: RepoAnalysisLimits = REPO_ANALYSIS_LIMITS,
): SelectedFileCandidate[] {
  return tree
    .filter((item) => item.type === "blob")
    .map((item): CandidateRepoFile => ({
      path: item.path,
      size: item.size ?? 0,
      sha: item.sha,
    }))
    .filter((file) => file.size > 0)
    .filter((file) => file.size <= limits.MAX_FILE_SIZE_BYTES)
    .filter((file) => !isIgnored(file.path))
    .map((file) => {
      const priority = priorityFor(file.path);
      return {
        ...file,
        language: detectLanguage(file.path),
        reason: priority.reason,
        priority: priority.priority,
      };
    })
    .sort((a, b) => b.priority - a.priority || a.size - b.size)
    .slice(0, limits.MAX_FILES_TO_FETCH);
}

export function applyTotalCharBudget(
  files: SelectedRepoFile[],
  limits: RepoAnalysisLimits = REPO_ANALYSIS_LIMITS,
): SelectedRepoFile[] {
  let totalChars = 0;
  const selected: SelectedRepoFile[] = [];

  for (const file of files) {
    if (totalChars + file.content.length > limits.MAX_TOTAL_CHARS) {
      continue;
    }

    selected.push(file);
    totalChars += file.content.length;
  }

  return selected;
}

export function toSelectedFileMetadata(files: SelectedRepoFile[]): SelectedFileMetadata[] {
  return files.map((file) => ({
    path: file.path,
    language: file.language,
    size: file.size,
    reason: file.reason,
    sha: file.sha,
    hash: createHash("sha256").update(file.content).digest("hex"),
    snippet: file.content.slice(0, 600),
  }));
}
