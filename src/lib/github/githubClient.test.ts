import { describe, expect, it, vi } from "vitest";
import { githubFetch } from "@/lib/github/githubClient";

describe("githubFetch auth headers", () => {
  it("signs installation token requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }), headers: new Headers() });
    vi.stubGlobal("fetch", fetchMock);

    await githubFetch("/repos/a/b", { auth: { mode: "installation", token: "inst-token", installationId: "42" } });

    const call = fetchMock.mock.calls[0];
    expect(call[1].headers.Authorization).toBe("Bearer inst-token");
  });
});
