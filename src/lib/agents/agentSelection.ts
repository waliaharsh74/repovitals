export const ANALYSIS_AGENT_IDS = ["architecture", "security", "performance", "testing"] as const;

export type AnalysisAgentId = (typeof ANALYSIS_AGENT_IDS)[number];

export type SelectableAnalysisAgent = {
  id: AnalysisAgentId;
  label: string;
  shortLabel: string;
  description: string;
  workflowStepId: string;
  agentName: string;
};

export const SELECTABLE_ANALYSIS_AGENTS: SelectableAnalysisAgent[] = [
  {
    id: "architecture",
    label: "Architecture and maintainability",
    shortLabel: "Architecture",
    description: "System structure, module boundaries, maintainability risks, and architecture tradeoffs.",
    workflowStepId: "architecture-agent",
    agentName: "ArchitectureAgent",
  },
  {
    id: "security",
    label: "Security",
    shortLabel: "Security",
    description: "Auth boundaries, validation, secrets exposure, redirects, SSRF-style fetches, and session handling.",
    workflowStepId: "security-agent",
    agentName: "SecurityAgent",
  },
  {
    id: "performance",
    label: "Performance",
    shortLabel: "Performance",
    description: "Expensive paths, caching gaps, pagination risks, scalability limits, and avoidable work.",
    workflowStepId: "performance-agent",
    agentName: "PerformanceAgent",
  },
  {
    id: "testing",
    label: "Testing",
    shortLabel: "Testing",
    description: "Coverage signals, missing critical-path tests, brittle tests, and testability gaps.",
    workflowStepId: "testing-agent",
    agentName: "TestingAgent",
  },
];

export const DEFAULT_ANALYSIS_AGENT_IDS: AnalysisAgentId[] = [...ANALYSIS_AGENT_IDS];

const ANALYSIS_AGENT_ID_SET = new Set<string>(ANALYSIS_AGENT_IDS);

export function isAnalysisAgentId(value: unknown): value is AnalysisAgentId {
  return typeof value === "string" && ANALYSIS_AGENT_ID_SET.has(value);
}

export function normalizeAnalysisAgentIds(value: unknown): AnalysisAgentId[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_ANALYSIS_AGENT_IDS];
  }

  const normalized = value.filter(isAnalysisAgentId);
  return normalized.length > 0 ? Array.from(new Set(normalized)) : [...DEFAULT_ANALYSIS_AGENT_IDS];
}

export function formatAnalysisAgentSelection(agentIds: AnalysisAgentId[]): string {
  const selected = new Set(agentIds);
  return SELECTABLE_ANALYSIS_AGENTS.filter((agent) => selected.has(agent.id))
    .map((agent) => agent.shortLabel)
    .join(", ");
}

export function areAllAnalysisAgentsSelected(agentIds: AnalysisAgentId[]): boolean {
  const selected = new Set(agentIds);
  return ANALYSIS_AGENT_IDS.every((agentId) => selected.has(agentId));
}
