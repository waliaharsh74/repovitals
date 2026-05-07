import type { z } from "zod";

export type GenerateObjectInput<TSchema extends z.ZodTypeAny> = {
  system: string;
  prompt: string;
  schema: TSchema;
  temperature?: number;
  maxTokens?: number;
};

export type GenerateTextInput = {
  system: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
};

export interface AIProvider {
  name: string;
  generateText(input: GenerateTextInput): Promise<string>;
  generateObject<TSchema extends z.ZodTypeAny>(
    input: GenerateObjectInput<TSchema>,
  ): Promise<z.infer<TSchema>>;
}
