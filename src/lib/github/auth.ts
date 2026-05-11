export type GithubAuthMode =
  | { mode: "token"; token: string }
  | { mode: "installation"; token: string; installationId: string }
  | { mode: "none" };

export function resolveGithubAuth(input?: {
  installationToken?: string | null;
  installationId?: string | null;
  token?: string | null;
}): GithubAuthMode {
  if (input?.installationToken && input.installationId) {
    return { mode: "installation", token: input.installationToken, installationId: input.installationId };
  }

  if (input?.token) {
    return { mode: "token", token: input.token };
  }

  if (process.env.GITHUB_TOKEN) {
    return { mode: "token", token: process.env.GITHUB_TOKEN };
  }

  return { mode: "none" };
}
