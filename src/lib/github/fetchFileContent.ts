import { resolveGithubAuth } from "@/lib/github/auth";
import { AppError, GithubAccessDeniedError, GithubInstallationRequiredError, GithubRateLimitError } from "@/lib/utils/errors";

type FetchFileContentInput = {
  owner: string;
  repo: string;
  branch: string;
  path: string;
  installationToken?: string;
  installationId?: string;
  signal?: AbortSignal;
};

export async function fetchFileContent(input: FetchFileContentInput): Promise<string> {
  const encodedPath = input.path.split("/").map(encodeURIComponent).join("/");
  const url = `https://raw.githubusercontent.com/${encodeURIComponent(input.owner)}/${encodeURIComponent(
    input.repo,
  )}/${encodeURIComponent(input.branch)}/${encodedPath}`;

  const auth = resolveGithubAuth({
    installationToken: input.installationToken,
    installationId: input.installationId,
  });

  const headers: HeadersInit = {
    "User-Agent": "RepoVitals-MVP",
  };

  if (auth.mode !== "none") {
    headers.Authorization = `Bearer ${auth.token}`;
  }

  const response = await fetch(url, { headers, signal: input.signal });

  if (response.status === 403 || response.status === 429) {
    throw new GithubRateLimitError();
  }

  if (response.status === 404 && auth.mode === "installation") {
    throw new GithubInstallationRequiredError();
  }

  if (response.status === 403) {
    throw new GithubAccessDeniedError();
  }

  if (!response.ok) {
    throw new AppError(
      "ANALYSIS_FAILED",
      `Could not fetch file ${input.path}: HTTP ${response.status}`,
      response.status,
    );
  }

  return response.text();
}
