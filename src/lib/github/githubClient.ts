import {
  GithubAccessDeniedError,
  GithubInstallationRequiredError,
  GithubRateLimitError,
  GithubRepoNotFoundError,
  AppError,
} from "@/lib/utils/errors";
import type { GithubAuthMode } from "@/lib/github/auth";

const GITHUB_API_BASE = "https://api.github.com";

type RequestOptions = {
  headers?: HeadersInit;
  auth?: GithubAuthMode;
  signal?: AbortSignal;
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

function githubHeaders(auth?: GithubAuthMode): HeadersInit {
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "User-Agent": "RepoVitals-MVP",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (auth && auth.mode !== "none") {
    headers.Authorization = `Bearer ${auth.token}`;
  }

  return headers;
}

function mapGithubPermissionError(response: Response, auth?: GithubAuthMode): never {
  if (response.status === 404 && auth?.mode === "installation") {
    throw new GithubInstallationRequiredError();
  }

  if (response.status === 403) {
    throw new GithubAccessDeniedError();
  }

  throw new GithubRepoNotFoundError();
}

export async function githubFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${GITHUB_API_BASE}${path}`, {
    ...options,
    headers: {
      ...githubHeaders(options.auth),
      ...options.headers,
    },
    signal: options.signal,
  });

  if (response.status === 401) {
    throw new GithubAccessDeniedError("GitHub authorization expired or is no longer valid.");
  }

  if (response.status === 404 || response.status === 403) {
    mapGithubPermissionError(response, options.auth);
  }

  if (response.status === 429) {
    throw new GithubRateLimitError();
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

export async function fetchRepoMetadata(
  owner: string,
  repo: string,
  auth?: GithubAuthMode,
  signal?: AbortSignal,
): Promise<GithubRepoMetadata> {
  const data = await githubFetch<{
    name: string;
    owner: { login: string };
    default_branch: string;
    html_url: string;
  }>(`/repos/${owner}/${repo}`, { auth, signal });

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
  auth?: GithubAuthMode,
  signal?: AbortSignal,
): Promise<GithubTreeResponse> {
  return githubFetch<GithubTreeResponse>(
    `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    { auth, signal },
  );
}
