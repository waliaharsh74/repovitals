import { resolveGithubAuth } from "@/lib/github/auth";
import { fetchGitTree, fetchRepoMetadata, type GithubTreeItem } from "@/lib/github/githubClient";

export type RepoTreeResult = {
  owner: string;
  repo: string;
  defaultBranch: string;
  normalizedUrl: string;
  tree: GithubTreeItem[];
  truncated: boolean;
};

export async function fetchRepoTree(
  owner: string,
  repo: string,
  options?: {
    installationToken?: string;
    installationId?: string;
    token?: string;
    signal?: AbortSignal;
  },
): Promise<RepoTreeResult> {
  const auth = resolveGithubAuth({
    installationToken: options?.installationToken,
    installationId: options?.installationId,
    token: options?.token,
  });
  const metadata = await fetchRepoMetadata(owner, repo, auth, options?.signal);
  const tree = await fetchGitTree(metadata.owner, metadata.name, metadata.defaultBranch, auth, options?.signal);

  return {
    owner: metadata.owner,
    repo: metadata.name,
    defaultBranch: metadata.defaultBranch,
    normalizedUrl: metadata.url,
    tree: tree.tree,
    truncated: tree.truncated,
  };
}
