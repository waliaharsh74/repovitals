import { GroqProvider } from "@/lib/ai/providers/GroqProvider";
import { OpenAIProvider } from "@/lib/ai/providers/OpenAIProvider";
import type { AIProvider } from "@/lib/ai/providers/AIProvider";
import type { AIProviderName } from "@/lib/agents/types";

export function createAIProvider(input: {
  provider: AIProviderName;
  apiKey: string;
  signal?: AbortSignal;
}): AIProvider {
  if (input.provider === "openai") {
    return new OpenAIProvider({ apiKey: input.apiKey, signal: input.signal });
  }

  if (input.provider === "groq") {
    return new GroqProvider({ apiKey: input.apiKey, signal: input.signal });
  }

  throw new Error(`Unsupported AI provider: ${(input as { provider: string }).provider}`);
}
