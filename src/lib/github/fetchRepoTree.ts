import { fetchGitTree, fetchRepoMetadata, type GithubTreeItem } from "@/lib/github/githubClient";

export type RepoTreeResult = {
  owner: string;
  repo: string;
  defaultBranch: string;
  normalizedUrl: string;
  tree: GithubTreeItem[];
  truncated: boolean;
};

export async function fetchRepoTree(owner: string, repo: string): Promise<RepoTreeResult> {
  const metadata = await fetchRepoMetadata(owner, repo);
  const tree = await fetchGitTree(metadata.owner, metadata.name, metadata.defaultBranch);

  return {
    owner: metadata.owner,
    repo: metadata.name,
    defaultBranch: metadata.defaultBranch,
    normalizedUrl: metadata.url,
    tree: tree.tree,
    truncated: tree.truncated,
  };
}
