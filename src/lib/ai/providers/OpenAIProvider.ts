import OpenAI from "openai";
import type { z } from "zod";
import type {
  AIProvider,
  GenerateObjectInput,
  GenerateTextInput,
} from "@/lib/ai/providers/AIProvider";
import { parseWithSchema, rootJsonSchema, schemaName } from "@/lib/ai/providers/json";
import {
  ProviderAuthenticationError,
  ProviderRateLimitError,
  AnalysisFailedError,
} from "@/lib/utils/errors";
import { redactApiKey } from "@/lib/ai/redact";

type OpenAIProviderInput = {
  apiKey: string;
  model?: string;
  signal?: AbortSignal;
};

export class OpenAIProvider implements AIProvider {
  name = "openai";
  private client: OpenAI;
  private model: string;
  private signal?: AbortSignal;

  constructor(input: OpenAIProviderInput) {
    this.client = new OpenAI({ apiKey: input.apiKey });
    this.model = input.model ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";
    this.signal = input.signal;
  }

  async generateText(input: GenerateTextInput): Promise<string> {
    try {
      const response = await this.client.chat.completions.create(
        {
          model: this.model,
          temperature: input.temperature ?? 0.2,
          max_tokens: input.maxTokens ?? 1800,
          messages: [
            { role: "system", content: input.system },
            { role: "user", content: input.prompt },
          ],
        },
        { signal: input.signal ?? this.signal },
      );

      return response.choices[0]?.message.content ?? "";
    } catch (error) {
      throw normalizeOpenAIError(error);
    }
  }

  async generateObject<TSchema extends z.ZodTypeAny>(
    input: GenerateObjectInput<TSchema>,
  ): Promise<z.infer<TSchema>> {
    const name = schemaName(input.schema);
    const jsonSchema = rootJsonSchema(input.schema);
    const prompt = `${input.prompt}\n\nReturn only JSON that matches the provided schema.`;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await this.client.chat.completions.create(
          {
            model: this.model,
            temperature: input.temperature ?? 0.1,
            max_tokens: input.maxTokens ?? 2200,
            response_format: {
              type: "json_schema",
              json_schema: {
                name,
                strict: false,
                schema: jsonSchema,
              },
            } as never,
            messages: [
              { role: "system", content: input.system },
              { role: "user", content: prompt },
            ],
          },
          { signal: input.signal ?? this.signal },
        );

        return parseWithSchema(input.schema, response.choices[0]?.message.content ?? "{}");
      } catch (error) {
        if (attempt === 1) {
          throw normalizeOpenAIError(error);
        }
      }
    }

    throw new AnalysisFailedError("OpenAI structured output failed.");
  }
}

function normalizeOpenAIError(error: unknown): Error {
  const status = typeof error === "object" && error && "status" in error ? Number(error.status) : undefined;
  const message = redactApiKey(error instanceof Error ? error.message : String(error));

  if (status === 401 || status === 403) {
    return new ProviderAuthenticationError();
  }

  if (status === 429) {
    return new ProviderRateLimitError();
  }

  return new AnalysisFailedError(message || "OpenAI request failed.");
}
