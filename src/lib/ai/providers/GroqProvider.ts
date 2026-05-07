import Groq from "groq-sdk";
import type { z } from "zod";
import type {
  AIProvider,
  GenerateObjectInput,
  GenerateTextInput,
} from "@/lib/ai/providers/AIProvider";
import { parseWithSchema, rootJsonSchema } from "@/lib/ai/providers/json";
import {
  AnalysisFailedError,
  ProviderAuthenticationError,
  ProviderRateLimitError,
} from "@/lib/utils/errors";
import { redactApiKey } from "@/lib/ai/redact";

type GroqProviderInput = {
  apiKey: string;
  model?: string;
};

export class GroqProvider implements AIProvider {
  name = "groq";
  private client: Groq;
  private model: string;

  constructor(input: GroqProviderInput) {
    this.client = new Groq({ apiKey: input.apiKey });
    this.model = input.model ?? process.env.GROQ_MODEL ?? "llama-3.1-8b-instant";
  }

  async generateText(input: GenerateTextInput): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        temperature: input.temperature ?? 0.2,
        max_tokens: input.maxTokens ?? 1800,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.prompt },
        ],
      });

      return response.choices[0]?.message?.content ?? "";
    } catch (error) {
      throw normalizeGroqError(error);
    }
  }

  async generateObject<TSchema extends z.ZodTypeAny>(
    input: GenerateObjectInput<TSchema>,
  ): Promise<z.infer<TSchema>> {
    const jsonSchema = rootJsonSchema(input.schema);
    const schemaText = JSON.stringify(jsonSchema, null, 2);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const prompt = [
          input.prompt,
          "",
          "Return only a single valid JSON object. Do not wrap it in Markdown.",
          "The JSON object must satisfy this JSON Schema:",
          schemaText,
          attempt > 0
            ? "The previous response did not validate. Fix the JSON shape, enum values, required fields, and value types."
            : "",
        ]
          .filter(Boolean)
          .join("\n");

        const response = await this.client.chat.completions.create({
          model: this.model,
          temperature: input.temperature ?? 0.1,
          max_tokens: input.maxTokens ?? 2200,
          response_format: {
            type: "json_object",
          } as never,
          messages: [
            { role: "system", content: input.system },
            { role: "user", content: prompt },
          ],
        });

        return parseWithSchema(input.schema, response.choices[0]?.message?.content ?? "{}");
      } catch (error) {
        if (attempt === 1) {
          throw normalizeGroqError(error);
        }
      }
    }

    throw new AnalysisFailedError("Groq structured output failed.");
  }
}

function normalizeGroqError(error: unknown): Error {
  const status = typeof error === "object" && error && "status" in error ? Number(error.status) : undefined;
  const message = redactApiKey(error instanceof Error ? error.message : String(error));

  if (status === 401 || status === 403) {
    return new ProviderAuthenticationError();
  }

  if (status === 429) {
    return new ProviderRateLimitError();
  }

  return new AnalysisFailedError(message || "Groq request failed.");
}
