export type AIProviderName = "openai" | "groq";

export type AnalysisCategory =
  | "architecture"
  | "security"
  | "performance"
  | "maintainability"
  | "testing";

export type Severity = "critical" | "high" | "medium" | "low";

export type RepoFile = {
  path: string;
  language: string;
  size: number;
  content: string;
  sha?: string;
};

export type SelectedRepoFile = {
  path: string;
  language: string;
  size: number;
  reason: string;
  content: string;
  sha?: string;
};

export type SelectedFileMetadata = {
  path: string;
  language: string;
  size: number;
  reason: string;
  sha?: string;
  hash?: string;
  snippet?: string;
};

export type Finding = {
  title: string;
  category: AnalysisCategory;
  severity: Severity;
  confidence: number;
  filePath?: string;
  lineHint?: number;
  explanation: string;
  recommendation: string;
  suggestedPatch?: string;
};

export type Scorecard = {
  architecture: number;
  security: number;
  performance: number;
  maintainability: number;
  testing: number;
  overall: number;
};

export type AgentTraceStep = {
  agent: string;
  status: "started" | "completed" | "failed";
  message: string;
  startedAt: string;
  completedAt?: string;
};

export type AnalysisReport = {
  repoUrl: string;
  repoName: string;
  summary: string;
  scorecard: Scorecard;
  architectureDiagramMermaid: string;
  findings: Finding[];
  recommendations: string[];
  agentTrace: AgentTraceStep[];
};

export type RepoContext = {
  owner: string;
  name: string;
  normalizedUrl: string;
  defaultBranch: string;
  analyzedFileCount: number;
  selectedFileCount: number;
  totalSelectedChars: number;
  isPartial: boolean;
};

export type AgentInput = {
  provider: import("@/lib/ai/providers/AIProvider").AIProvider;
  repo: RepoContext;
  files: SelectedRepoFile[];
  previousFindings?: Finding[];
};

export type AgentOutput = {
  summary?: string;
  architectureDiagramMermaid?: string;
  findings: Finding[];
  recommendations?: string[];
};

export type FileClassification = {
  path: string;
  category:
    | "config"
    | "frontend"
    | "backend"
    | "database"
    | "auth"
    | "infra"
    | "tests"
    | "unknown";
  reason: string;
};
