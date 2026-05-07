import type { FileClassification, RepoContext, SelectedRepoFile } from "@/lib/agents/types";

function categoryFor(path: string): FileClassification["category"] {
  const lower = path.toLowerCase();

  if (/(^|\/)(test|tests|__tests__)\//.test(lower) || /\.(test|spec)\./.test(lower)) {
    return "tests";
  }
  if (lower.includes(".github/workflows/") || lower.includes("docker") || lower.endsWith(".yml")) {
    return "infra";
  }
  if (lower.includes("prisma/") || lower.includes("/db/") || lower.includes("/models/")) {
    return "database";
  }
  if (lower.includes("auth") || lower.includes("session") || lower.includes("middleware")) {
    return "auth";
  }
  if (lower.includes("/api/") || lower.includes("/server/") || lower.includes("/routes/") || lower.includes("/controllers/")) {
    return "backend";
  }
  if (lower.endsWith(".tsx") || lower.includes("/components/") || lower.includes("/pages/") || lower.includes("/app/")) {
    return "frontend";
  }
  if (
    lower.endsWith(".json") ||
    lower.endsWith(".config.ts") ||
    lower.endsWith(".config.js") ||
    lower.endsWith(".toml") ||
    lower.endsWith(".md")
  ) {
    return "config";
  }

  return "unknown";
}

function reasonFor(category: FileClassification["category"], file: SelectedRepoFile): string {
  if (file.reason) {
    return file.reason;
  }

  return `Classified as ${category} from its path and extension.`;
}

export function runFileClassifierAgent(input: {
  repo: RepoContext;
  files: SelectedRepoFile[];
}): FileClassification[] {
  return input.files.map((file) => {
    const category = categoryFor(file.path);
    return {
      path: file.path,
      category,
      reason: reasonFor(category, file),
    };
  });
}
