import type { AgentInput, AgentOutput } from "@/lib/agents/types";
import { agentReviewSchema } from "@/lib/agents/schemas";
import { performanceSystemPrompt, performanceUserPrompt } from "@/lib/ai/prompts/performancePrompt";

export async function runPerformanceAgent(input: AgentInput): Promise<AgentOutput> {
  const result = await input.provider.generateObject({
    system: performanceSystemPrompt(),
    prompt: performanceUserPrompt(input.repo, input.files, input.previousFindings ?? []),
    schema: agentReviewSchema,
    temperature: 0.1,
    maxTokens: 2400,
  });

  return {
    summary: result.summary,
    findings: result.findings,
    recommendations: result.recommendations,
  };
}
