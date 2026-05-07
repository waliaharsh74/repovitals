import { z } from "zod";
import { zodToJsonSchema, type JsonSchema7Type } from "zod-to-json-schema";

type RootObjectJsonSchema = JsonSchema7Type & { type: "object" };

export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    const first = candidate.indexOf("{");
    const last = candidate.lastIndexOf("}");
    if (first >= 0 && last > first) {
      return JSON.parse(candidate.slice(first, last + 1));
    }

    throw new Error("Provider returned non-JSON output.");
  }
}

export function parseWithSchema<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  text: string,
): z.infer<TSchema> {
  return schema.parse(extractJsonObject(text));
}

export function schemaName(schema: z.ZodTypeAny): string {
  return schema.description?.replace(/[^A-Za-z0-9_-]/g, "_") || "RepoVitalsSchema";
}

export function rootJsonSchema(schema: z.ZodTypeAny): RootObjectJsonSchema {
  const jsonSchema = zodToJsonSchema(schema, { $refStrategy: "none" });

  if (!isRootObjectJsonSchema(jsonSchema)) {
    throw new Error("Structured output schema must be a root JSON object.");
  }

  return jsonSchema;
}

function isRootObjectJsonSchema(schema: unknown): schema is RootObjectJsonSchema {
  return Boolean(
    schema &&
      typeof schema === "object" &&
      "type" in schema &&
      (schema as { type?: unknown }).type === "object",
  );
}
