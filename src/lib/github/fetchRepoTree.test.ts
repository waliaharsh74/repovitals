import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchRepoTree } from "@/lib/github/fetchRepoTree";

describe("fetchRepoTree", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the provided GitHub user token for metadata and tree requests", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            name: "repo",
            owner: { login: "owner" },
            default_branch: "main",
            html_url: "https://github.com/owner/repo",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            sha: "tree-sha",
            truncated: false,
            tree: [
              {
                path: "src/app.ts",
                mode: "100644",
                type: "blob",
                sha: "blob-sha",
                size: 42,
                url: "https://api.github.com/blob",
              },
            ],
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const tree = await fetchRepoTree("owner", "repo", { token: "user-token" });

    expect(tree.tree).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer user-token");
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe("Bearer user-token");
  });
});
