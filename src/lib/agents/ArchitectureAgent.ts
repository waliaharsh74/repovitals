import type { AgentInput, AgentOutput } from "@/lib/agents/types";
import { architectureReviewSchema } from "@/lib/agents/schemas";
import { architectureSystemPrompt, architectureUserPrompt } from "@/lib/ai/prompts/architecturePrompt";

export async function runArchitectureAgent(input: AgentInput): Promise<AgentOutput> {
  const result = await input.provider.generateObject({
    system: architectureSystemPrompt(),
    prompt: architectureUserPrompt(input.repo, input.files),
    schema: architectureReviewSchema,
    temperature: 0.1,
    maxTokens: 2600,
  });

  return {
    summary: result.summary,
    architectureDiagramMermaid: result.architectureDiagramMermaid,
    findings: result.findings,
    recommendations: result.recommendations,
  };
}
