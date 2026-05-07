import { describe, expect, it } from "vitest";
import { analyzeSchema } from "@/lib/validators/analyzeSchema";

describe("analyzeSchema", () => {
  it("accepts valid analysis input", () => {
    expect(
      analyzeSchema.parse({
        provider: "openai",
        apiKey: "sk-test",
        repoUrl: "owner/repo",
      }),
    ).toEqual({
      provider: "openai",
      apiKey: "sk-test",
      analysisDepth: "standard",
      repoUrl: "owner/repo",
    });
  });

  it("accepts expanded coverage mode", () => {
    expect(
      analyzeSchema.parse({
        provider: "openai",
        apiKey: "sk-test",
        analysisDepth: "expanded",
        repoUrl: "owner/repo",
      }).analysisDepth,
    ).toBe("expanded");
  });

  it("rejects invalid provider, missing key, and invalid repo URL", () => {
    expect(() =>
      analyzeSchema.parse({
        provider: "anthropic",
        apiKey: "",
        repoUrl: "https://example.com/owner/repo",
      }),
    ).toThrow();
  });
});
