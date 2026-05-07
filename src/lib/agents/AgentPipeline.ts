import { REPO_ANALYSIS_LIMITS, type RepoAnalysisLimits } from "@/lib/ai/tokenBudget";
import type { AIProvider } from "@/lib/ai/providers/AIProvider";
import type { AnalysisWorkflowStepId, EmitAnalysisProgress } from "@/lib/analysis/progress";
import { runArchitectureAgent } from "@/lib/agents/ArchitectureAgent";
import { runFileClassifierAgent } from "@/lib/agents/FileClassifierAgent";
import { runPerformanceAgent } from "@/lib/agents/PerformanceAgent";
import { runReportSynthesisAgent } from "@/lib/agents/ReportSynthesisAgent";
import { runSecurityAgent } from "@/lib/agents/SecurityAgent";
import { runTestingAgent } from "@/lib/agents/TestingAgent";
import type {
  AgentOutput,
  AgentTraceStep,
  AnalysisReport,
  Finding,
  RepoContext,
  SelectedRepoFile,
} from "@/lib/agents/types";

type PipelineInput = {
  provider: AIProvider;
  repo: RepoContext;
  files: SelectedRepoFile[];
  limits?: RepoAnalysisLimits;
  onProgress?: EmitAnalysisProgress;
};

function severityRank(severity: Finding["severity"]): number {
  return {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  }[severity];
}

function sortAndCapFindings(findings: Finding[], limits: RepoAnalysisLimits): Finding[] {
  return [...findings]
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || b.confidence - a.confidence)
    .slice(0, limits.MAX_FINDINGS);
}

function fallbackDiagram(repo: RepoContext): string {
  return [
    "flowchart TD",
    `  A["GitHub repo: ${repo.owner}/${repo.name}"] --> B["Selected source files"]`,
    '  B --> C["RepoVitals agents"]',
    '  C --> D["Production-readiness report"]',
  ].join("\n");
}

export async function runAgentPipeline(input: PipelineInput): Promise<AnalysisReport> {
  const limits = input.limits ?? REPO_ANALYSIS_LIMITS;
  const trace: AgentTraceStep[] = [];
  const findings: Finding[] = [];
  const recommendations: string[] = [];
  let architectureDiagramMermaid = fallbackDiagram(input.repo);

  async function runStep<T>(
    agent: string,
    stepId: AnalysisWorkflowStepId,
    message: string,
    task: () => Promise<T>,
  ): Promise<T> {
    const startedAt = new Date().toISOString();
    const step: AgentTraceStep = {
      agent,
      status: "started",
      message,
      startedAt,
    };
    trace.push(step);
    await input.onProgress?.({
      step: stepId,
      status: "running",
      message,
    });

    try {
      const result = await task();
      step.status = "completed";
      step.completedAt = new Date().toISOString();
      await input.onProgress?.({
        step: stepId,
        status: "completed",
        message: `${agent} completed.`,
      });
      return result;
    } catch (error) {
      step.status = "failed";
      step.completedAt = new Date().toISOString();
      step.message = error instanceof Error ? error.message : "Agent failed.";
      await input.onProgress?.({
        step: stepId,
        status: "failed",
        message: step.message,
      });
      throw error;
    }
  }

  await runStep("FileClassifierAgent", "file-classifier", "Classifying selected files deterministically.", async () => {
    runFileClassifierAgent({ repo: input.repo, files: input.files });
  });

  const architecture = await runStep<AgentOutput>(
    "ArchitectureAgent",
    "architecture-agent",
    "Reviewing architecture and maintainability.",
    () =>
      runArchitectureAgent({
        provider: input.provider,
        repo: input.repo,
        files: input.files,
        previousFindings: findings,
      }),
  );
  architectureDiagramMermaid = architecture.architectureDiagramMermaid ?? architectureDiagramMermaid;
  findings.push(...architecture.findings);
  recommendations.push(...(architecture.recommendations ?? []));

  const security = await runStep<AgentOutput>("SecurityAgent", "security-agent", "Reviewing security risks.", () =>
    runSecurityAgent({
      provider: input.provider,
      repo: input.repo,
      files: input.files,
      previousFindings: findings,
    }),
  );
  findings.push(...security.findings);
  recommendations.push(...(security.recommendations ?? []));

  const performance = await runStep<AgentOutput>(
    "PerformanceAgent",
    "performance-agent",
    "Reviewing performance and scalability risks.",
    () =>
      runPerformanceAgent({
        provider: input.provider,
        repo: input.repo,
        files: input.files,
        previousFindings: findings,
      }),
  );
  findings.push(...performance.findings);
  recommendations.push(...(performance.recommendations ?? []));

  const testing = await runStep<AgentOutput>("TestingAgent", "testing-agent", "Reviewing testability gaps.", () =>
    runTestingAgent({
      provider: input.provider,
      repo: input.repo,
      files: input.files,
      previousFindings: findings,
    }),
  );
  findings.push(...testing.findings);
  recommendations.push(...(testing.recommendations ?? []));

  const cappedFindings = sortAndCapFindings(findings, limits);
  const synthesis = await runStep("ReportSynthesisAgent", "report-synthesis", "Synthesizing final report.", () =>
    runReportSynthesisAgent({
      provider: input.provider,
      repo: input.repo,
      findings: cappedFindings,
      recommendations,
    }),
  );

  return {
    repoUrl: input.repo.normalizedUrl,
    repoName: `${input.repo.owner}/${input.repo.name}`,
    summary: synthesis.summary,
    scorecard: synthesis.scorecard,
    architectureDiagramMermaid,
    findings: cappedFindings,
    recommendations: synthesis.recommendations,
    agentTrace: trace,
  };
}
