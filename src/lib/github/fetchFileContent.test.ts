import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchFileContent } from "@/lib/github/fetchFileContent";

describe("fetchFileContent", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the GitHub blob API when an auth token is provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          content: Buffer.from("export const ok = true;\n", "utf8").toString("base64"),
          encoding: "base64",
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const content = await fetchFileContent({
      owner: "owner",
      repo: "repo",
      branch: "main",
      path: "src/app.ts",
      sha: "blob-sha",
      token: "user-token",
    });

    expect(content).toBe("export const ok = true;\n");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/repos/owner/repo/git/blobs/blob-sha",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer user-token",
        }),
      }),
    );
  });
});
