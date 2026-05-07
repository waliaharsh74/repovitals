import { z } from "zod";
import { parseGithubUrl } from "@/lib/github/parseGithubUrl";

export const analyzeSchema = z.object({
  provider: z.enum(["openai", "groq"]),
  apiKey: z.string().min(1, "Provider API key is required."),
  analysisDepth: z.enum(["standard", "expanded"]).default("standard"),
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
