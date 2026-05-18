import { afterEach, describe, expect, it } from "vitest";
import {
  decryptAnalysisSecret,
  encryptAnalysisSecret,
} from "@/lib/analysis/jobSecrets";

const originalSecret = process.env.ANALYSIS_JOB_SECRET;

afterEach(() => {
  process.env.ANALYSIS_JOB_SECRET = originalSecret;
});

describe("analysis job secrets", () => {
  it("round-trips encrypted OpenAI credentials", () => {
    process.env.ANALYSIS_JOB_SECRET = "test-analysis-job-secret-with-32-characters";

    const encrypted = encryptAnalysisSecret("openai-key");

    expect(encrypted).not.toContain("openai-key");
    expect(decryptAnalysisSecret(encrypted)).toBe("openai-key");
  });

  it("rejects malformed encrypted payloads", () => {
    process.env.ANALYSIS_JOB_SECRET = "test-analysis-job-secret-with-32-characters";

    expect(() => decryptAnalysisSecret("v1.invalid")).toThrow("Analysis job credential payload is invalid.");
  });
});
