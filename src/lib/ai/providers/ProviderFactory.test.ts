import { describe, expect, it } from "vitest";
import { createAIProvider } from "@/lib/ai/providers/ProviderFactory";

describe("createAIProvider", () => {
  it("creates OpenAI provider", () => {
    expect(createAIProvider({ provider: "openai", apiKey: "sk-test" }).name).toBe("openai");
  });

  it("creates Groq provider", () => {
    expect(createAIProvider({ provider: "groq", apiKey: "gsk_test" }).name).toBe("groq");
  });

  it("rejects unsupported providers", () => {
    expect(() =>
      createAIProvider({ provider: "anthropic", apiKey: "test" } as never),
    ).toThrow("Unsupported AI provider");
  });
});
