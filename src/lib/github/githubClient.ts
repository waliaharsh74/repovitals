import {
  GithubRateLimitError,
  GithubRepoNotFoundError,
  AppError,
} from "@/lib/utils/errors";

const GITHUB_API_BASE = "https://api.github.com";

type RequestOptions = {
  headers?: HeadersInit;
};

export type GithubRepoMetadata = {
  owner: string;
  name: string;
  defaultBranch: string;
  url: string;
};

export type GithubTreeItem = {
  path: string;
  mode: string;
  type: "blob" | "tree" | "commit";
  sha: string;
  size?: number;
  url: string;
};

export type GithubTreeResponse = {
  sha: string;
  truncated: boolean;
  tree: GithubTreeItem[];
};

function githubHeaders(): HeadersInit {
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "User-Agent": "RepoVitals-MVP",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  return headers;
}

export async function githubFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${GITHUB_API_BASE}${path}`, {
    ...options,
    headers: {
      ...githubHeaders(),
      ...options.headers,
    },
  });

  if (response.status === 404) {
    throw new GithubRepoNotFoundError();
  }

  if (response.status === 403 || response.status === 429) {
    const remaining = response.headers.get("x-ratelimit-remaining");
    if (remaining === "0" || response.status === 429) {
      throw new GithubRateLimitError();
    }
  }

  if (!response.ok) {
    const text = await response.text();
    throw new AppError(
      "ANALYSIS_FAILED",
      `GitHub request failed with ${response.status}: ${text.slice(0, 240)}`,
      response.status,
    );
  }

  return (await response.json()) as T;
}

export async function fetchRepoMetadata(owner: string, repo: string): Promise<GithubRepoMetadata> {
  const data = await githubFetch<{
    name: string;
    owner: { login: string };
    default_branch: string;
    html_url: string;
  }>(`/repos/${owner}/${repo}`);

  return {
    owner: data.owner.login,
    name: data.name,
    defaultBranch: data.default_branch,
    url: data.html_url,
  };
}

export async function fetchGitTree(
  owner: string,
  repo: string,
  branch: string,
): Promise<GithubTreeResponse> {
  return githubFetch<GithubTreeResponse>(
    `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
  );
}
