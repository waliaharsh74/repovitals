import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const repoUrl = searchParams.get("repoUrl") ?? "";
  const appInstallUrl = process.env.GITHUB_APP_INSTALL_URL;

  if (!appInstallUrl) {
    return NextResponse.json(
      {
        error: {
          code: "GITHUB_APP_NOT_CONFIGURED",
          message: "GitHub App install URL is not configured.",
        },
      },
      { status: 500 },
    );
  }

  const redirect = new URL(appInstallUrl);
  if (repoUrl) {
    redirect.searchParams.set("state", repoUrl);
  }

  return NextResponse.redirect(redirect);
}
