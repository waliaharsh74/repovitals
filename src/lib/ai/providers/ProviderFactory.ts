import { GroqProvider } from "@/lib/ai/providers/GroqProvider";
import { OpenAIProvider } from "@/lib/ai/providers/OpenAIProvider";
import type { AIProvider } from "@/lib/ai/providers/AIProvider";
import type { AIProviderName } from "@/lib/agents/types";

export function createAIProvider(input: {
  provider: AIProviderName;
  apiKey: string;
}): AIProvider {
  if (input.provider === "openai") {
    return new OpenAIProvider({ apiKey: input.apiKey });
  }

  if (input.provider === "groq") {
    return new GroqProvider({ apiKey: input.apiKey });
  }

  throw new Error(`Unsupported AI provider: ${(input as { provider: string }).provider}`);
}
