import { resolveGithubAuth } from "@/lib/github/auth";
import { githubFetch } from "@/lib/github/githubClient";
import { AppError, GithubAccessDeniedError, GithubRateLimitError } from "@/lib/utils/errors";

type FetchFileContentInput = {
  owner: string;
  repo: string;
  branch: string;
  path: string;
  sha?: string;
  token?: string;
  installationToken?: string;
  installationId?: string;
  signal?: AbortSignal;
};

type GithubBlobResponse = {
  content: string;
  encoding: string;
};

type GithubContentResponse =
  | {
      type: "file";
      content: string;
      encoding: string;
    }
  | unknown[];

function decodeGithubContent(input: {
  content: string;
  encoding: string;
  path: string;
}) {
  if (input.encoding !== "base64") {
    throw new AppError(
      "ANALYSIS_FAILED",
      `Could not decode file ${input.path}: unsupported GitHub encoding ${input.encoding}.`,
    );
  }

  return Buffer.from(input.content.replace(/\s/g, ""), "base64").toString("utf8");
}

async function fetchAuthenticatedFileContent(
  input: FetchFileContentInput,
  auth: Exclude<ReturnType<typeof resolveGithubAuth>, { mode: "none" }>,
) {
  if (input.sha) {
    const blob = await githubFetch<GithubBlobResponse>(
      `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/git/blobs/${encodeURIComponent(
        input.sha,
      )}`,
      { auth, signal: input.signal },
    );

    return decodeGithubContent({
      content: blob.content,
      encoding: blob.encoding,
      path: input.path,
    });
  }

  const encodedPath = input.path.split("/").map(encodeURIComponent).join("/");
  const content = await githubFetch<GithubContentResponse>(
    `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/contents/${encodedPath}?ref=${encodeURIComponent(
      input.branch,
    )}`,
    { auth, signal: input.signal },
  );

  if (Array.isArray(content) || content.type !== "file") {
    throw new AppError("ANALYSIS_FAILED", `GitHub path ${input.path} is not a file.`);
  }

  return decodeGithubContent({
    content: content.content,
    encoding: content.encoding,
    path: input.path,
  });
}

export async function fetchFileContent(input: FetchFileContentInput): Promise<string> {
  const auth = resolveGithubAuth({
    installationToken: input.installationToken,
    installationId: input.installationId,
    token: input.token,
  });

  if (auth.mode !== "none") {
    return fetchAuthenticatedFileContent(input, auth);
  }

  const encodedPath = input.path.split("/").map(encodeURIComponent).join("/");
  const url = `https://raw.githubusercontent.com/${encodeURIComponent(input.owner)}/${encodeURIComponent(
    input.repo,
  )}/${encodeURIComponent(input.branch)}/${encodedPath}`;

  const headers: HeadersInit = {
    "User-Agent": "RepoVitals-MVP",
  };

  const response = await fetch(url, { headers, signal: input.signal });

  if (response.status === 429) {
    throw new GithubRateLimitError();
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
