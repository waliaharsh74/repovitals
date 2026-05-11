import { describe, expect, it } from "vitest";
import { resolveGithubAuth } from "@/lib/github/auth";

describe("resolveGithubAuth", () => {
  it("prefers installation token", () => {
    expect(resolveGithubAuth({ installationToken: "inst", installationId: "1", token: "pat" })).toEqual({
      mode: "installation",
      token: "inst",
      installationId: "1",
    });
  });

  it("falls back to PAT token", () => {
    expect(resolveGithubAuth({ token: "pat" })).toEqual({ mode: "token", token: "pat" });
  });
});
