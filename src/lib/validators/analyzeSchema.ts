import { z } from "zod";
import { ANALYSIS_AGENT_IDS, DEFAULT_ANALYSIS_AGENT_IDS } from "@/lib/agents/agentSelection";
import { parseGithubUrl } from "@/lib/github/parseGithubUrl";

export const analyzeSchema = z.object({
  apiKey: z.string().min(1, "OpenAI API key is required."),
  analysisDepth: z.enum(["standard", "expanded"]).default("standard"),
  agentIds: z
    .array(z.enum(ANALYSIS_AGENT_IDS))
    .min(1, "Select at least one review agent.")
    .default([...DEFAULT_ANALYSIS_AGENT_IDS]),
  repoUrl: z
    .string()
    .min(1, "GitHub repository URL is required.")
    .refine(
      (value) => {
        try {
          parseGithubUrl(value);
          return true;
        } catch {
          return false;
        }
      },
      { message: "Enter a valid GitHub repository URL or owner/repo path." },
    ),
});

export type AnalyzeInput = z.infer<typeof analyzeSchema>;
