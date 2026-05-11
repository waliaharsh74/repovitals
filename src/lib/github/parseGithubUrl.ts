import { InvalidGithubUrlError } from "@/lib/utils/errors";

export type ParsedGithubRepo = {
  owner: string;
  repo: string;
  defaultBranch?: string;
  normalizedUrl: string;
  host: string;
};

const OWNER_REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

function isAllowedGithubHost(hostname: string) {
  return hostname === "github.com" || hostname.endsWith(".ghe.com") || hostname.endsWith(".githubenterprise.com");
}

export function parseGithubUrl(input: string): ParsedGithubRepo {
  const value = input.trim();
  if (!value) throw new InvalidGithubUrlError();
  let ownerRepo = value;
  let host = "github.com";

  if (value.startsWith("http://")) throw new InvalidGithubUrlError("Only HTTPS GitHub repository URLs are supported.");

  if (value.startsWith("https://")) {
    const url = new URL(value);
    if (!isAllowedGithubHost(url.hostname)) {
      throw new InvalidGithubUrlError("Repository URL must use a supported GitHub host.");
    }
    host = url.hostname;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length !== 2) throw new InvalidGithubUrlError();
    ownerRepo = `${parts[0]}/${parts[1]}`;
  } else if (value.startsWith("github.com/")) {
    const parts = value.split("/").filter(Boolean);
    if (parts.length !== 3) throw new InvalidGithubUrlError();
    ownerRepo = `${parts[1]}/${parts[2]}`;
  }

  ownerRepo = ownerRepo.replace(/\/$/, "");
  if (!OWNER_REPO_PATTERN.test(ownerRepo)) throw new InvalidGithubUrlError();

  const [owner, rawRepo] = ownerRepo.split("/");
  const repo = rawRepo.replace(/\.git$/, "");
  if (!owner || !repo) throw new InvalidGithubUrlError();

  return { owner, repo, host, normalizedUrl: `https://${host}/${owner}/${repo}` };
}
