import { describe, expect, it } from "vitest";
import { EXPANDED_REPO_ANALYSIS_LIMITS, REPO_ANALYSIS_LIMITS } from "@/lib/ai/tokenBudget";
import type { GithubTreeItem } from "@/lib/github/githubClient";
import {
  applyTotalCharBudget,
  selectImportantFileCandidates,
} from "@/lib/github/selectImportantFiles";

function blob(path: string, size = 100): GithubTreeItem {
  return {
    path,
    size,
    sha: `sha-${path}`,
    type: "blob",
    mode: "100644",
    url: `https://api.github.com/${path}`,
  };
}

describe("selectImportantFileCandidates", () => {
  it("ignores generated, lock, and binary files while prioritizing source files", () => {
    const selected = selectImportantFileCandidates([
      blob("node_modules/pkg/index.js"),
      blob("pnpm-lock.yaml"),
      blob("public/logo.png"),
      blob("README.md"),
      blob("package.json"),
      blob("src/app/api/analyze/route.ts"),
      blob("prisma/schema.prisma"),
      blob("src/app/page.tsx", REPO_ANALYSIS_LIMITS.MAX_FILE_SIZE_BYTES + 1),
    ]);

    expect(selected.map((file) => file.path)).toEqual([
      "README.md",
      "package.json",
      "prisma/schema.prisma",
      "src/app/api/analyze/route.ts",
    ]);
  });

  it("respects max files to fetch", () => {
    const tree = Array.from({ length: 100 }, (_, index) => blob(`src/lib/file-${index}.ts`));
    const selected = selectImportantFileCandidates(tree);
    expect(selected).toHaveLength(REPO_ANALYSIS_LIMITS.MAX_FILES_TO_FETCH);
  });

  it("uses expanded limits when provided", () => {
    const tree = Array.from({ length: 160 }, (_, index) => blob(`src/lib/file-${index}.ts`));
    const selected = selectImportantFileCandidates(tree, EXPANDED_REPO_ANALYSIS_LIMITS);
    expect(selected).toHaveLength(EXPANDED_REPO_ANALYSIS_LIMITS.MAX_FILES_TO_FETCH);
  });
});

describe("applyTotalCharBudget", () => {
  it("keeps selected file content under the total character limit", () => {
    const files = [
      {
        path: "a.ts",
        language: "TypeScript",
        size: 10,
        reason: "source",
        content: "a".repeat(200_000),
      },
      {
        path: "b.ts",
        language: "TypeScript",
        size: 10,
        reason: "source",
        content: "b".repeat(150_000),
      },
    ];

    const selected = applyTotalCharBudget(files);
    expect(selected).toHaveLength(1);
    expect(selected[0].path).toBe("a.ts");
  });
});
