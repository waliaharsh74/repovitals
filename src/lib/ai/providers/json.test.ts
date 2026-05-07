import { describe, expect, it } from "vitest";
import { architectureReviewSchema } from "@/lib/agents/schemas";
import { rootJsonSchema, schemaName } from "@/lib/ai/providers/json";

describe("provider JSON helpers", () => {
  it("builds an OpenAI-compatible root object schema", () => {
    const jsonSchema = rootJsonSchema(architectureReviewSchema);

    expect(schemaName(architectureReviewSchema)).toBe("RepoVitalsArchitectureReview");
    expect(jsonSchema.type).toBe("object");
    expect(jsonSchema).not.toHaveProperty("$ref");
    expect(jsonSchema).not.toHaveProperty("definitions");
  });
});
