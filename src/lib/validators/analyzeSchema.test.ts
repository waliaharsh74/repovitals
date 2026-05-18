import { describe, expect, it } from "vitest";
import { analyzeSchema } from "@/lib/validators/analyzeSchema";

describe("analyzeSchema", () => {
  it("accepts valid analysis input", () => {
    expect(
      analyzeSchema.parse({
        apiKey: "sk-test",
        repoUrl: "owner/repo",
      }),
    ).toEqual({
      apiKey: "sk-test",
      analysisDepth: "standard",
      agentIds: ["architecture", "security", "performance", "testing"],
      repoUrl: "owner/repo",
    });
  });

  it("accepts expanded coverage mode", () => {
    expect(
      analyzeSchema.parse({
        apiKey: "sk-test",
        analysisDepth: "expanded",
        repoUrl: "owner/repo",
      }).analysisDepth,
    ).toBe("expanded");
  });

  it("accepts a custom agent selection", () => {
    expect(
      analyzeSchema.parse({
        apiKey: "sk-test",
        agentIds: ["security", "testing"],
        repoUrl: "owner/repo",
      }).agentIds,
    ).toEqual(["security", "testing"]);
  });

  it("rejects an empty agent selection", () => {
    expect(() =>
      analyzeSchema.parse({
        apiKey: "sk-test",
        agentIds: [],
        repoUrl: "owner/repo",
      }),
    ).toThrow();
  });

  it("rejects missing key and invalid repo URL", () => {
    expect(() =>
      analyzeSchema.parse({
        apiKey: "",
        repoUrl: "https://example.com/owner/repo",
      }),
    ).toThrow();
  });
});
