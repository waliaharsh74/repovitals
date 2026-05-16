import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/github/repos/route";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getGithubUserAccessToken: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock("@/lib/github/oauth", () => ({
  getGithubUserAccessToken: mocks.getGithubUserAccessToken,
}));

describe("GET /api/github/repos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns unauthorized when there is no signed-in app user", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: { code: "UNAUTHORIZED", message: "Sign in required." },
    });
  });

  it("returns the token helper error when GitHub is not connected", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "user-id" });
    mocks.getGithubUserAccessToken.mockResolvedValue({
      ok: false,
      status: 400,
      code: "GITHUB_OAUTH_REQUIRED",
      message: "Connect GitHub to load repositories.",
    });

    const response = await GET();

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: { code: "GITHUB_OAUTH_REQUIRED", message: "Connect GitHub to load repositories." },
    });
  });

  it("refreshes the GitHub token and retries when GitHub rejects the stored token", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "user-id" });
    mocks.getGithubUserAccessToken
      .mockResolvedValueOnce({ ok: true, token: "stale-token" })
      .mockResolvedValueOnce({ ok: true, token: "fresh-token" });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "Bad credentials" }), { status: 401 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: 1,
              full_name: "owner/repo",
              private: true,
              html_url: "https://github.com/owner/repo",
            },
          ]),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET();

    expect(mocks.getGithubUserAccessToken).toHaveBeenNthCalledWith(1, "user-id");
    expect(mocks.getGithubUserAccessToken).toHaveBeenNthCalledWith(2, "user-id", {
      forceRefresh: true,
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.github.com/user/repos?per_page=100&sort=updated",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer stale-token" }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.github.com/user/repos?per_page=100&sort=updated",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer fresh-token" }),
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      repositories: [
        {
          id: 1,
          fullName: "owner/repo",
          private: true,
          url: "https://github.com/owner/repo",
        },
      ],
    });
  });
});
