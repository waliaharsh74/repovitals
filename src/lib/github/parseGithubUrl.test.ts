import { describe, expect, it } from "vitest";
import { parseGithubUrl } from "@/lib/github/parseGithubUrl";

describe("parseGithubUrl", () => {
  it.each([
    ["https://github.com/vercel/next.js", "vercel", "next.js"],
    ["https://github.com/vercel/next.js/", "vercel", "next.js"],
    ["github.com/vercel/next.js", "vercel", "next.js"],
    ["vercel/next.js", "vercel", "next.js"],
  ])("parses %s", (input, owner, repo) => {
    expect(parseGithubUrl(input)).toEqual({
      owner,
      repo,
      normalizedUrl: `https://github.com/${owner}/${repo}`,
    });
  });

  it.each([
    "",
    "https://example.com/a/b",
    "http://github.com/a/b",
    "github.com/a",
    "https://github.com/a/b/issues",
    "not a repo",
  ])(
    "rejects %s",
    (input) => {
      expect(() => parseGithubUrl(input)).toThrow();
    },
  );
});
