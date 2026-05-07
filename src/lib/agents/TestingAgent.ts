import type { AgentInput, AgentOutput } from "@/lib/agents/types";
import { agentReviewSchema } from "@/lib/agents/schemas";
import { testingSystemPrompt, testingUserPrompt } from "@/lib/ai/prompts/testingPrompt";

export async function runTestingAgent(input: AgentInput): Promise<AgentOutput> {
  const result = await input.provider.generateObject({
    system: testingSystemPrompt(),
    prompt: testingUserPrompt(input.repo, input.files, input.previousFindings ?? []),
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
