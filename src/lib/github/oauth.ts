import type { Account } from "next-auth";
import { envValue } from "@/lib/auth/env";
import { prisma } from "@/lib/db/prisma";

const GITHUB_TOKEN_ENDPOINT = "https://github.com/login/oauth/access_token";
const TOKEN_REFRESH_SKEW_SECONDS = 60;

export type GithubUserAccessTokenErrorCode =
  | "GITHUB_OAUTH_REQUIRED"
  | "GITHUB_REAUTH_REQUIRED"
  | "GITHUB_OAUTH_NOT_CONFIGURED"
  | "GITHUB_TOKEN_REFRESH_FAILED";

export type GithubUserAccessTokenResult =
  | { ok: true; token: string }
  | {
      ok: false;
      status: number;
      code: GithubUserAccessTokenErrorCode;
      message: string;
    };

type GithubOAuthRefreshResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type GithubAccount = NonNullable<Awaited<ReturnType<typeof findGithubAccount>>>;

type TokenLookupOptions = {
  forceRefresh?: boolean;
  now?: Date;
};

function secondsSinceEpoch(date: Date) {
  return Math.floor(date.getTime() / 1000);
}

function shouldRefresh(account: GithubAccount, options: TokenLookupOptions) {
  if (options.forceRefresh) {
    return true;
  }

  if (!account.expires_at) {
    return false;
  }

  return account.expires_at <= secondsSinceEpoch(options.now ?? new Date()) + TOKEN_REFRESH_SKEW_SECONDS;
}

function githubOAuthRequired(): GithubUserAccessTokenResult {
  return {
    ok: false,
    status: 400,
    code: "GITHUB_OAUTH_REQUIRED",
    message: "Connect GitHub to load repositories.",
  };
}

function githubReauthRequired(): GithubUserAccessTokenResult {
  return {
    ok: false,
    status: 401,
    code: "GITHUB_REAUTH_REQUIRED",
    message: "Your GitHub authorization expired. Sign in with GitHub again.",
  };
}

function githubOAuthNotConfigured(): GithubUserAccessTokenResult {
  return {
    ok: false,
    status: 500,
    code: "GITHUB_OAUTH_NOT_CONFIGURED",
    message: "GitHub OAuth is not configured.",
  };
}

function githubTokenRefreshFailed(): GithubUserAccessTokenResult {
  return {
    ok: false,
    status: 502,
    code: "GITHUB_TOKEN_REFRESH_FAILED",
    message: "GitHub authorization could not be refreshed. Try again shortly.",
  };
}

async function findGithubAccount(userId: string) {
  return prisma.account.findFirst({
    where: { userId, provider: "github" },
    orderBy: { id: "desc" },
  });
}

async function handlePossiblyConcurrentRefreshFailure(
  userId: string,
  previousAccount: GithubAccount,
  now: Date,
): Promise<GithubUserAccessTokenResult> {
  const latestAccount = await findGithubAccount(userId);

  if (
    latestAccount?.access_token &&
    latestAccount.access_token !== previousAccount.access_token &&
    !shouldRefresh(latestAccount, { now })
  ) {
    return { ok: true, token: latestAccount.access_token };
  }

  return githubReauthRequired();
}

async function refreshGithubAccessToken(
  userId: string,
  account: GithubAccount,
  now: Date,
): Promise<GithubUserAccessTokenResult> {
  if (!account.refresh_token) {
    return githubReauthRequired();
  }

  const clientId = envValue("GITHUB_CLIENT_ID", "AUTH_GITHUB_ID");
  const clientSecret = envValue("GITHUB_CLIENT_SECRET", "AUTH_GITHUB_SECRET");

  if (!clientId || !clientSecret) {
    return githubOAuthNotConfigured();
  }

  const response = await fetch(GITHUB_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "RepoVitals-MVP",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: account.refresh_token,
    }),
    cache: "no-store",
  });

  let payload: GithubOAuthRefreshResponse;

  try {
    payload = (await response.json()) as GithubOAuthRefreshResponse;
  } catch {
    return githubTokenRefreshFailed();
  }

  if (payload.error === "bad_refresh_token") {
    return handlePossiblyConcurrentRefreshFailure(userId, account, now);
  }

  if (!response.ok || payload.error || !payload.access_token) {
    return githubTokenRefreshFailed();
  }

  const expiresAt =
    typeof payload.expires_in === "number" ? secondsSinceEpoch(now) + payload.expires_in : null;

  await prisma.account.update({
    where: { id: account.id },
    data: {
      access_token: payload.access_token,
      expires_at: expiresAt,
      refresh_token: payload.refresh_token ?? null,
      scope: payload.scope ?? account.scope,
      token_type: payload.token_type ?? account.token_type,
    },
  });

  return { ok: true, token: payload.access_token };
}

export async function persistGithubAccountTokens(userId: string, account: Account) {
  if (account.provider !== "github" || !account.providerAccountId || !account.access_token) {
    return;
  }

  await prisma.account.updateMany({
    where: {
      userId,
      provider: "github",
      providerAccountId: account.providerAccountId,
    },
    data: {
      access_token: account.access_token,
      refresh_token: account.refresh_token ?? null,
      expires_at: account.expires_at ?? null,
      token_type: account.token_type ?? null,
      scope: account.scope ?? null,
      id_token: account.id_token ?? null,
      session_state:
        typeof account.session_state === "string" || account.session_state === null
          ? account.session_state
          : null,
    },
  });
}

export async function getGithubUserAccessToken(
  userId: string,
  options: TokenLookupOptions = {},
): Promise<GithubUserAccessTokenResult> {
  const account = await findGithubAccount(userId);

  if (!account?.access_token) {
    return githubOAuthRequired();
  }

  const now = options.now ?? new Date();

  if (!shouldRefresh(account, { ...options, now })) {
    return { ok: true, token: account.access_token };
  }

  return refreshGithubAccessToken(userId, account, now);
}
