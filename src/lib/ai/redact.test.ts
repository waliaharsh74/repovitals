import { describe, expect, it } from "vitest";
import { redactApiKey } from "@/lib/ai/redact";

describe("redactApiKey", () => {
  it("redacts common OpenAI key shapes", () => {
    const text = "openai sk-test_abcdefghijklmnopqrstuvwxyz";
    const redacted = redactApiKey(text);

    expect(redacted).not.toContain("sk-test_abcdefghijklmnopqrstuvwxyz");
    expect(redacted).toContain("[REDACTED]");
  });

  it("redacts object payloads", () => {
    const redacted = redactApiKey({ apiKey: "sk-abcdefghijklmnopqrstuvwxyz" });
    expect(redacted).toContain("[REDACTED]");
  });
});
