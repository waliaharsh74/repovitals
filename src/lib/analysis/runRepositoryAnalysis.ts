import { OpenAIProvider } from "@/lib/ai/providers/OpenAIProvider";
import {
  getRepoAnalysisLimits,
  type AnalysisDepth,
  type RepoAnalysisLimits,
} from "@/lib/ai/tokenBudget";
import type { EmitAnalysisProgress } from "@/lib/analysis/progress";
import type { RepoContext, SelectedRepoFile } from "@/lib/agents/types";
import { runAgentPipeline } from "@/lib/agents/AgentPipeline";
import { parseGithubUrl } from "@/lib/github/parseGithubUrl";
import { fetchFileContent } from "@/lib/github/fetchFileContent";
import { fetchRepoTree } from "@/lib/github/fetchRepoTree";
import {
  applyTotalCharBudget,
  selectImportantFileCandidates,
  toSelectedFileMetadata,
} from "@/lib/github/selectImportantFiles";
import { AnalysisFailedError } from "@/lib/utils/errors";

export type RepositoryAnalysisResult = {
  repository: {
    owner: string;
    name: string;
    url: string;
    defaultBranch: string;
  };
  report: Awaited<ReturnType<typeof runAgentPipeline>>;
  selectedFiles: ReturnType<typeof toSelectedFileMetadata>;
};

export type PreparedRepositoryAnalysis = {
  repository: RepositoryAnalysisResult["repository"];
  repoContext: RepoContext;
  files: SelectedRepoFile[];
  selectedFiles: ReturnType<typeof toSelectedFileMetadata>;
  limits: RepoAnalysisLimits;
};

export async function prepareRepositoryAnalysis(input: {
  repoUrl: string;
  analysisDepth?: AnalysisDepth;
  limits?: RepoAnalysisLimits;
  onProgress?: EmitAnalysisProgress;
  signal?: AbortSignal;
}): Promise<PreparedRepositoryAnalysis> {
  const limits = input.limits ?? getRepoAnalysisLimits(input.analysisDepth);
  const emit = input.onProgress;

  await emit?.({
    step: "fetch-tree",
    status: "running",
    message: "Reading repository metadata and file tree from GitHub.",
  });

  const parsed = parseGithubUrl(input.repoUrl);
  const repoTree = await fetchRepoTree(parsed.owner, parsed.repo, { signal: input.signal });
  const blobCount = repoTree.tree.filter((item) => item.type === "blob").length;

  await emit?.({
    step: "fetch-tree",
    status: "completed",
    message: "Repository tree loaded.",
    detail: `${blobCount} files found on ${repoTree.defaultBranch}.`,
  });

  await emit?.({
    step: "select-files",
    status: "running",
    message: "Prioritizing files for production-readiness review.",
    detail: `Budget: ${limits.MAX_FILES_TO_FETCH} files, ${limits.MAX_TOTAL_CHARS.toLocaleString()} total characters.`,
  });

  const candidates = selectImportantFileCandidates(repoTree.tree, limits);

  if (candidates.length === 0) {
    throw new AnalysisFailedError("RepoVitals could not find supported source or configuration files to analyze.");
  }

  await emit?.({
    step: "select-files",
    status: "completed",
    message: "Important files selected.",
    detail: `${candidates.length} candidate files matched the review policy.`,
  });

  await emit?.({
    step: "fetch-files",
    status: "running",
    message: "Downloading selected public source files.",
  });

  const fetchedFiles = await Promise.all(
    candidates.map(async (file): Promise<SelectedRepoFile | null> => {
      try {
        const content = await fetchFileContent({
          owner: repoTree.owner,
          repo: repoTree.repo,
          branch: repoTree.defaultBranch,
          path: file.path,
          signal: input.signal,
        });

        if (!content.trim()) {
          return null;
        }

        return {
          path: file.path,
          language: file.language,
          size: file.size,
          reason: file.reason,
          sha: file.sha,
          content,
        };
      } catch {
        return null;
      }
    }),
  );

  const files = applyTotalCharBudget(
    fetchedFiles.filter((file): file is SelectedRepoFile => file !== null),
    limits,
  );

  if (files.length === 0) {
    throw new AnalysisFailedError("RepoVitals selected files but could not fetch their public contents.");
  }

  const totalSelectedChars = files.reduce((sum, file) => sum + file.content.length, 0);
  await emit?.({
    step: "fetch-files",
    status: "completed",
    message: "Selected file contents loaded.",
    detail: `${files.length} files, ${totalSelectedChars.toLocaleString()} characters prepared for agents.`,
  });

  const repo: RepoContext = {
    owner: repoTree.owner,
    name: repoTree.repo,
    normalizedUrl: repoTree.normalizedUrl,
    defaultBranch: repoTree.defaultBranch,
    analyzedFileCount: blobCount,
    selectedFileCount: files.length,
    totalSelectedChars,
    isPartial:
      repoTree.truncated ||
      candidates.length >= limits.MAX_FILES_TO_FETCH ||
      totalSelectedChars >= limits.MAX_TOTAL_CHARS,
  };

  return {
    repository: {
      owner: repo.owner,
      name: repo.name,
      url: repo.normalizedUrl,
      defaultBranch: repo.defaultBranch,
    },
    repoContext: repo,
    files,
    selectedFiles: toSelectedFileMetadata(files),
    limits,
  };
}

export async function runPreparedRepositoryAnalysis(input: {
  apiKey: string;
  prepared: PreparedRepositoryAnalysis;
  onProgress?: EmitAnalysisProgress;
  signal?: AbortSignal;
}): Promise<RepositoryAnalysisResult> {
  const provider = new OpenAIProvider({ apiKey: input.apiKey, signal: input.signal });

  const report = await runAgentPipeline({
    provider,
    repo: input.prepared.repoContext,
    files: input.prepared.files,
    limits: input.prepared.limits,
    onProgress: input.onProgress,
  });

  return {
    repository: input.prepared.repository,
    report,
    selectedFiles: input.prepared.selectedFiles,
  };
}

export async function runRepositoryAnalysis(input: {
  apiKey: string;
  repoUrl: string;
  analysisDepth?: AnalysisDepth;
  onProgress?: EmitAnalysisProgress;
  signal?: AbortSignal;
}): Promise<RepositoryAnalysisResult> {
  const prepared = await prepareRepositoryAnalysis({
    repoUrl: input.repoUrl,
    analysisDepth: input.analysisDepth,
    onProgress: input.onProgress,
    signal: input.signal,
  });
  return runPreparedRepositoryAnalysis({
    apiKey: input.apiKey,
    prepared,
    onProgress: input.onProgress,
    signal: input.signal,
  });
}
