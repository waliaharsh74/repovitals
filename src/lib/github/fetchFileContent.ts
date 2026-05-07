import { AppError, GithubRateLimitError } from "@/lib/utils/errors";

type FetchFileContentInput = {
  owner: string;
  repo: string;
  branch: string;
  path: string;
};

export async function fetchFileContent(input: FetchFileContentInput): Promise<string> {
  const encodedPath = input.path.split("/").map(encodeURIComponent).join("/");
  const url = `https://raw.githubusercontent.com/${encodeURIComponent(input.owner)}/${encodeURIComponent(
    input.repo,
  )}/${encodeURIComponent(input.branch)}/${encodedPath}`;

  const headers: HeadersInit = {
    "User-Agent": "RepoVitals-MVP",
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const response = await fetch(url, { headers });

  if (response.status === 403 || response.status === 429) {
    throw new GithubRateLimitError();
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
