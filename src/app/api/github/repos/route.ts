import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getGithubUserAccessToken, type GithubUserAccessTokenResult } from "@/lib/github/oauth";

type GithubRepo = {
  id: number;
  full_name: string;
  private: boolean;
  html_url: string;
};

function tokenErrorResponse(result: Extract<GithubUserAccessTokenResult, { ok: false }>) {
  return NextResponse.json(
    {
      error: {
        code: result.code,
        message: result.message,
      },
    },
    { status: result.status },
  );
}

async function fetchGithubRepos(accessToken: string) {
  return fetch("https://api.github.com/user/repos?per_page=100&sort=updated", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "RepoVitals-MVP",
    },
    cache: "no-store",
  });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  }

  const token = await getGithubUserAccessToken(user.id);
  if (!token.ok) {
    return tokenErrorResponse(token);
  }

  let response = await fetchGithubRepos(token.token);

  if (response.status === 401) {
    const refreshedToken = await getGithubUserAccessToken(user.id, { forceRefresh: true });
    if (!refreshedToken.ok) {
      return tokenErrorResponse(refreshedToken);
    }

    response = await fetchGithubRepos(refreshedToken.token);
  }

  if (response.status === 401) {
    return NextResponse.json(
      {
        error: {
          code: "GITHUB_REAUTH_REQUIRED",
          message: "Your GitHub authorization expired. Sign out and sign in with GitHub again.",
        },
      },
      { status: 401 },
    );
  }

  if (response.status === 403) {
    return NextResponse.json(
      {
        error: {
          code: "GITHUB_SCOPE_REQUIRED",
          message: "GitHub permissions are insufficient. Reconnect GitHub and grant repository access.",
        },
      },
      { status: 403 },
    );
  }

  if (!response.ok) {
    return NextResponse.json(
      { error: { code: "GITHUB_REPO_LIST_FAILED", message: "Could not load GitHub repositories." } },
      { status: response.status },
    );
  }

  const data = (await response.json()) as GithubRepo[];
  return NextResponse.json({
    repositories: data.map((repo) => ({
      id: repo.id,
      fullName: repo.full_name,
      private: repo.private,
      url: repo.html_url,
    })),
  });
}
