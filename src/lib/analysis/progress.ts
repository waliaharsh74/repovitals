import {
  DEFAULT_ANALYSIS_AGENT_IDS,
  SELECTABLE_ANALYSIS_AGENTS,
  type AnalysisAgentId,
} from "@/lib/agents/agentSelection";

export type AnalysisWorkflowStepId =
  | "validate-input"
  | "fetch-tree"
  | "select-files"
  | "fetch-files"
  | "create-report"
  | "file-classifier"
  | "architecture-agent"
  | "security-agent"
  | "performance-agent"
  | "testing-agent"
  | "report-synthesis"
  | "persist-report";

export type AnalysisProgressStatus = "pending" | "running" | "completed" | "failed";
export type AnalysisJobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export type AnalysisProgressPayload = {
  step: AnalysisWorkflowStepId;
  status: Exclude<AnalysisProgressStatus, "pending">;
  message: string;
  detail?: string;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
  updatedAt?: string;
};

export type AnalysisProgressRecord = {
  step: AnalysisWorkflowStepId;
  status: AnalysisProgressStatus;
  message: string;
  detail?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  failedAt?: string | null;
  updatedAt: string;
};

export type AnalysisJobSnapshot = {
  jobId: string;
  reportId: string;
  status: AnalysisJobStatus;
  errorCode: string | null;
  errorMessage: string | null;
  queueJobId: string | null;
  selectedAgentIds: AnalysisAgentId[];
  progress: AnalysisProgressRecord[];
};

export type AnalysisProgressEvent =
  | ({ type: "progress" } & AnalysisProgressPayload)
  | {
      type: "snapshot";
      jobId: string;
      reportId: string;
      status: AnalysisJobStatus;
      selectedAgentIds: AnalysisAgentId[];
      steps: AnalysisProgressRecord[];
      message?: string;
    }
  | {
      type: "complete";
      jobId?: string;
      reportId: string;
      message: string;
    }
  | {
      type: "error";
      jobId?: string;
      code: string;
      message: string;
      reportId?: string;
    };

export type EmitAnalysisProgress = (event: AnalysisProgressPayload) => void | Promise<void>;

export const ANALYSIS_WORKFLOW_STEPS: {
  id: AnalysisWorkflowStepId;
  label: string;
  description: string;
}[] = [
  {
    id: "validate-input",
    label: "Validate request",
    description: "Check OpenAI key presence and GitHub repo format.",
  },
  {
    id: "fetch-tree",
    label: "Read repository tree",
    description: "Fetch public repository metadata and the file tree from GitHub.",
  },
  {
    id: "select-files",
    label: "Choose review files",
    description: "Prioritize source, config, database, API, and test files under the active budget.",
  },
  {
    id: "fetch-files",
    label: "Download source",
    description: "Fetch selected public file contents for the review agents.",
  },
  {
    id: "create-report",
    label: "Create report record",
    description: "Open a durable report entry before AI analysis starts.",
  },
  {
    id: "file-classifier",
    label: "Classify files",
    description: "Categorize selected files by role in the system.",
  },
  {
    id: "architecture-agent",
    label: "Review architecture",
    description: "Map system structure, maintainability risks, and architecture tradeoffs.",
  },
  {
    id: "security-agent",
    label: "Review security",
    description: "Check input validation, auth boundaries, secrets, SSRF, and related risks.",
  },
  {
    id: "performance-agent",
    label: "Review performance",
    description: "Look for expensive paths, caching gaps, pagination issues, and scalability risks.",
  },
  {
    id: "testing-agent",
    label: "Review testability",
    description: "Assess coverage signals and missing critical-path tests.",
  },
  {
    id: "report-synthesis",
    label: "Synthesize report",
    description: "Merge findings into scorecards, recommendations, and the final summary.",
  },
  {
    id: "persist-report",
    label: "Save results",
    description: "Persist findings, recommendations, selected file metadata, and agent trace.",
  },
];

const SELECTABLE_AGENT_STEP_IDS = new Set(
  SELECTABLE_ANALYSIS_AGENTS.map((agent) => agent.workflowStepId),
);

export function getAnalysisWorkflowSteps(
  selectedAgentIds: AnalysisAgentId[] = DEFAULT_ANALYSIS_AGENT_IDS,
): typeof ANALYSIS_WORKFLOW_STEPS {
  const selectedAgentStepIds = new Set(
    SELECTABLE_ANALYSIS_AGENTS.filter((agent) => selectedAgentIds.includes(agent.id)).map(
      (agent) => agent.workflowStepId,
    ),
  );

  return ANALYSIS_WORKFLOW_STEPS.filter(
    (step) => !SELECTABLE_AGENT_STEP_IDS.has(step.id) || selectedAgentStepIds.has(step.id),
  );
}
