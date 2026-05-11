import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

type GithubRepo = {
  id: number;
  full_name: string;
  private: boolean;
  html_url: string;
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  }

  const account = await prisma.account.findFirst({
    where: { userId: user.id, provider: "github" },
    orderBy: { id: "desc" },
  });

  if (!account?.access_token) {
    return NextResponse.json(
      { error: { code: "GITHUB_OAUTH_REQUIRED", message: "Connect GitHub to load repositories." } },
      { status: 400 },
    );
  }

  const response = await fetch("https://api.github.com/user/repos?per_page=100&sort=updated", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${account.access_token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "RepoVitals-MVP",
    },
    cache: "no-store",
  });

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
