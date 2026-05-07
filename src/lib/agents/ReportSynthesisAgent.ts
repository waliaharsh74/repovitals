import type { AIProvider } from "@/lib/ai/providers/AIProvider";
import { reportSystemPrompt, reportUserPrompt } from "@/lib/ai/prompts/reportPrompt";
import { reportSynthesisSchema } from "@/lib/agents/schemas";
import type { Finding, RepoContext, Scorecard } from "@/lib/agents/types";

export async function runReportSynthesisAgent(input: {
  provider: AIProvider;
  repo: RepoContext;
  findings: Finding[];
  recommendations: string[];
}): Promise<{
  summary: string;
  scorecard: Scorecard;
  recommendations: string[];
}> {
  return input.provider.generateObject({
    system: reportSystemPrompt(),
    prompt: reportUserPrompt(input.repo, input.findings, input.recommendations),
    schema: reportSynthesisSchema,
    temperature: 0.1,
    maxTokens: 1800,
  });
}
