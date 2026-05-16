import { beforeEach, describe, expect, it, vi } from "vitest";
import { getGithubUserAccessToken, persistGithubAccountTokens } from "@/lib/github/oauth";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    account: {
      findFirst: mocks.findFirst,
      update: mocks.update,
      updateMany: mocks.updateMany,
    },
  },
}));

describe("GitHub OAuth token handling", () => {
  const now = new Date("2026-05-12T12:00:00.000Z");
  const nowSeconds = Math.floor(now.getTime() / 1000);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    process.env.GITHUB_CLIENT_ID = "github-client-id";
    process.env.GITHUB_CLIENT_SECRET = "github-client-secret";
  });

  it("returns a stored token when it has not expired", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "account-id",
      access_token: "stored-token",
      refresh_token: "refresh-token",
      expires_at: nowSeconds + 3600,
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await getGithubUserAccessToken("user-id", { now });

    expect(result).toEqual({ ok: true, token: "stored-token" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("refreshes and persists an expired token", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "account-id",
      access_token: "expired-token",
      refresh_token: "old-refresh-token",
      expires_at: nowSeconds - 10,
      scope: "repo read:user",
      token_type: "bearer",
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "new-token",
          expires_in: 28800,
          refresh_token: "new-refresh-token",
          scope: "repo read:user",
          token_type: "bearer",
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getGithubUserAccessToken("user-id", { now });

    expect(result).toEqual({ ok: true, token: "new-token" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://github.com/login/oauth/access_token",
      expect.objectContaining({
        method: "POST",
        body: expect.any(URLSearchParams),
      }),
    );
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "account-id" },
      data: {
        access_token: "new-token",
        expires_at: nowSeconds + 28800,
        refresh_token: "new-refresh-token",
        scope: "repo read:user",
        token_type: "bearer",
      },
    });
  });

  it("requires GitHub reauthorization when an expired token cannot be refreshed", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "account-id",
      access_token: "expired-token",
      refresh_token: null,
      expires_at: nowSeconds - 10,
    });

    const result = await getGithubUserAccessToken("user-id", { now });

    expect(result).toEqual({
      ok: false,
      status: 401,
      code: "GITHUB_REAUTH_REQUIRED",
      message: "Your GitHub authorization expired. Sign in with GitHub again.",
    });
  });

  it("uses another request's freshly stored token after a refresh-token race", async () => {
    mocks.findFirst
      .mockResolvedValueOnce({
        id: "account-id",
        access_token: "expired-token",
        refresh_token: "old-refresh-token",
        expires_at: nowSeconds - 10,
      })
      .mockResolvedValueOnce({
        id: "account-id",
        access_token: "concurrent-token",
        refresh_token: "new-refresh-token",
        expires_at: nowSeconds + 3600,
      });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "bad_refresh_token" }), {
          status: 400,
        }),
      ),
    );

    const result = await getGithubUserAccessToken("user-id", { now });

    expect(result).toEqual({ ok: true, token: "concurrent-token" });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("persists new GitHub tokens when a user signs in again", async () => {
    await persistGithubAccountTokens("user-id", {
      provider: "github",
      providerAccountId: "github-user-id",
      type: "oauth",
      access_token: "new-token",
      refresh_token: "new-refresh-token",
      expires_at: nowSeconds + 28800,
      token_type: "bearer",
      scope: "repo read:user",
    });

    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: {
        userId: "user-id",
        provider: "github",
        providerAccountId: "github-user-id",
      },
      data: {
        access_token: "new-token",
        refresh_token: "new-refresh-token",
        expires_at: nowSeconds + 28800,
        token_type: "bearer",
        scope: "repo read:user",
        id_token: null,
        session_state: null,
      },
    });
  });
});
