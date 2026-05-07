import type { AgentInput, AgentOutput } from "@/lib/agents/types";
import { agentReviewSchema } from "@/lib/agents/schemas";
import { securitySystemPrompt, securityUserPrompt } from "@/lib/ai/prompts/securityPrompt";

export async function runSecurityAgent(input: AgentInput): Promise<AgentOutput> {
  const result = await input.provider.generateObject({
    system: securitySystemPrompt(),
    prompt: securityUserPrompt(input.repo, input.files, input.previousFindings ?? []),
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
