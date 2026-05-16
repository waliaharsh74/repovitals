import type { z } from "zod";

export type GenerateObjectInput<TSchema extends z.ZodTypeAny> = {
  system: string;
  prompt: string;
  schema: TSchema;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
};

export type GenerateTextInput = {
  system: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
};

export interface AIProvider {
  name: string;
  generateText(input: GenerateTextInput): Promise<string>;
  generateObject<TSchema extends z.ZodTypeAny>(
    input: GenerateObjectInput<TSchema>,
  ): Promise<z.infer<TSchema>>;
}
