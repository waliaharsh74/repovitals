"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CheckCircle2,
  Gauge,
  Github,
  Network,
  SearchCode,
  ShieldAlert,
  SlidersHorizontal,
  TestTube2,
  type LucideIcon,
} from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import type { AnalysisProgressEvent, AnalysisProgressRecord } from "@/lib/analysis/progress";
import {
  ANALYSIS_AGENT_IDS,
  DEFAULT_ANALYSIS_AGENT_IDS,
  SELECTABLE_ANALYSIS_AGENTS,
  areAllAnalysisAgentsSelected,
  type AnalysisAgentId,
} from "@/lib/agents/agentSelection";
import { analyzeSchema, type AnalyzeInput } from "@/lib/validators/analyzeSchema";
import { ApiKeyInput } from "@/components/analysis/ApiKeyInput";
import { AnalysisStatus } from "@/components/analysis/AnalysisStatus";
import {
  AnalysisWorkflow,
  createInitialWorkflowSteps,
  mergeWorkflowProgressRecords,
  type AnalysisWorkflowStepState,
} from "@/components/analysis/AnalysisWorkflow";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type GithubRepoOption = {
  id: number;
  fullName: string;
  private: boolean;
  url: string;
};

type ApiError = {
  error?: {
    code: string;
    message: string;
  };
  reportId?: string;
  jobId?: string;
  status?: string;
};

type AnalysisState = "idle" | "queued" | "running" | "error" | "success";
type AnalysisMode = "full" | "custom";

const agentIcons: Record<AnalysisAgentId, LucideIcon> = {
  architecture: Network,
  security: ShieldAlert,
  performance: Gauge,
  testing: TestTube2,
};

export function AnalyzeRepoForm() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [analysisState, setAnalysisState] = useState<AnalysisState>("idle");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [connectGithubPrompt, setConnectGithubPrompt] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [repoOptions, setRepoOptions] = useState<GithubRepoOption[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("full");
  const [workflowSteps, setWorkflowSteps] = useState<AnalysisWorkflowStepState[]>(
    () => createInitialWorkflowSteps(DEFAULT_ANALYSIS_AGENT_IDS),
  );
  const [showWorkflow, setShowWorkflow] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const form = useForm<AnalyzeInput>({
    resolver: zodResolver(analyzeSchema),
    defaultValues: {
      apiKey: "",
      analysisDepth: "standard",
      agentIds: [...DEFAULT_ANALYSIS_AGENT_IDS],
      repoUrl: "",
    },
  });

  const connectGithubUrl = useMemo(() => {
    const repoUrl = form.getValues("repoUrl");
    return `/api/github/install?repoUrl=${encodeURIComponent(repoUrl)}`;
  }, [form]);

  const isSubmitting = form.formState.isSubmitting;
  const isAnalysisActive = analysisState === "queued" || analysisState === "running";
  const isFormDisabled = isSubmitting || isAnalysisActive;
  const selectedAgentIds = form.watch("agentIds") ?? DEFAULT_ANALYSIS_AGENT_IDS;
  const selectedAgentSet = new Set(selectedAgentIds);
  const selectedAgentCount = selectedAgentSet.size;
  const isFullAnalysisSelected = areAllAnalysisAgentsSelected(selectedAgentIds);

  useEffect(() => {
    async function loadRepos() {
      setReposLoading(true);
      try {
        const response = await fetch("/api/github/repos", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as { repositories?: GithubRepoOption[] };
        if (payload.repositories) {
          setRepoOptions(payload.repositories);
        }
      } finally {
        setReposLoading(false);
      }
    }

    loadRepos();
  }, []);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  function applyProgressSnapshot(
    steps: AnalysisProgressRecord[],
    snapshotAgentIds: AnalysisAgentId[],
  ) {
    setWorkflowSteps(
      mergeWorkflowProgressRecords(createInitialWorkflowSteps(snapshotAgentIds), steps),
    );
  }

  function applyProgressEvent(event: AnalysisProgressEvent) {
    if (event.type === "snapshot") {
      applyProgressSnapshot(event.steps, event.selectedAgentIds);
      setActiveJobId(event.jobId);
      setAnalysisState(
        event.status === "pending"
          ? "queued"
          : event.status === "running"
            ? "running"
            : event.status === "completed"
              ? "success"
              : "error",
      );
      setStatusMessage(
        event.message ??
          (event.status === "pending" ? "Analysis queued. Waiting for the worker..." : "Analysis is running..."),
      );
      return;
    }

    if (event.type === "progress") {
      setWorkflowSteps((current) =>
        current.map((step) =>
          step.id === event.step
            ? {
                ...step,
                status: event.status,
                message: event.message,
                detail: event.detail,
              }
            : step,
        ),
      );
      setAnalysisState("running");
      setStatusMessage(event.message);
      return;
    }

    if (event.type === "complete") {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      setActiveJobId(null);
      setAnalysisState("success");
      setStatusMessage(event.message);
      router.push(`/reports/${event.reportId}`);
      return;
    }

    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setActiveJobId(null);
    setAnalysisState("error");
    setStatusMessage(null);
    setSubmitError(event.message);
  }

  async function handleApiResponse(response: Response) {
    const payload = (await response.json()) as ApiError;
    if (!response.ok) {
      setStatusMessage(null);
      setAnalysisState("error");
      setConnectGithubPrompt(payload.error?.code === "GITHUB_APP_INSTALLATION_REQUIRED");
      setSubmitError(payload.error?.message ?? "Analysis failed. Check the inputs and try again.");
      return;
    }

    if (!payload.jobId) {
      setAnalysisState("error");
      setSubmitError("Analysis was accepted but no job ID was returned.");
      return;
    }

    setActiveJobId(payload.jobId);
    setAnalysisState("queued");
    setStatusMessage("Analysis queued. Waiting for the worker...");
    subscribeToJob(payload.jobId);
  }

  function subscribeToJob(jobId: string) {
    eventSourceRef.current?.close();
    const source = new EventSource(`/api/analyze/jobs/${encodeURIComponent(jobId)}/events`);
    eventSourceRef.current = source;

    source.addEventListener("snapshot", (message) => {
      applyProgressEvent(JSON.parse(message.data) as AnalysisProgressEvent);
    });
    source.addEventListener("complete", (message) => {
      applyProgressEvent(JSON.parse(message.data) as AnalysisProgressEvent);
    });
    source.addEventListener("job-error", (message) => {
      applyProgressEvent(JSON.parse(message.data) as AnalysisProgressEvent);
    });
    source.onerror = () => {
      source.close();
      eventSourceRef.current = null;
      setActiveJobId(null);
      setAnalysisState("error");
      setStatusMessage(null);
      setSubmitError("Lost the analysis progress connection. Refresh the report from the dashboard or retry.");
    };
  }

  function updateAgentSelection(agentIds: AnalysisAgentId[]) {
    const orderedAgentIds = ANALYSIS_AGENT_IDS.filter((agentId) => agentIds.includes(agentId));
    form.setValue("agentIds", orderedAgentIds, {
      shouldDirty: true,
      shouldValidate: true,
    });

    if (showWorkflow && !isAnalysisActive) {
      setWorkflowSteps(createInitialWorkflowSteps(orderedAgentIds));
    }
  }

  function chooseFullAnalysis() {
    setAnalysisMode("full");
    updateAgentSelection([...DEFAULT_ANALYSIS_AGENT_IDS]);
  }

  function chooseCustomAnalysis() {
    setAnalysisMode("custom");
    if (selectedAgentIds.length === 0) {
      updateAgentSelection(["security"]);
    }
  }

  function toggleAgent(agentId: AnalysisAgentId) {
    const currentlySelected = selectedAgentSet.has(agentId);
    if (currentlySelected && selectedAgentCount === 1) {
      return;
    }

    updateAgentSelection(
      currentlySelected
        ? selectedAgentIds.filter((selectedAgentId) => selectedAgentId !== agentId)
        : [...selectedAgentIds, agentId],
    );
  }

  async function onSubmit(values: AnalyzeInput) {
    setSubmitError(null);
    setConnectGithubPrompt(false);
    setStatusMessage("Validating request...");
    setAnalysisState("queued");
    setActiveJobId(null);
    setWorkflowSteps(createInitialWorkflowSteps(values.agentIds));
    setShowWorkflow(true);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      await handleApiResponse(response);
    } catch (error) {
      setStatusMessage(null);
      setAnalysisState("error");
      setSubmitError(error instanceof Error ? error.message : "Analysis failed. Check the inputs and try again.");
    }
  }

  async function cancelActiveJob() {
    if (!activeJobId) {
      return;
    }

    setStatusMessage("Cancelling analysis...");
    await fetch(`/api/analyze/jobs/${encodeURIComponent(activeJobId)}/cancel`, {
      method: "POST",
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Analyze a repository</CardTitle>
        <CardDescription>
          Paste any repo URL. If it is private, RepoVitals will guide you to connect GitHub App access.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
          <Controller
            control={form.control}
            name="apiKey"
            render={({ field }) => (
              <ApiKeyInput value={field.value} onChange={field.onChange} disabled={isFormDisabled} />
            )}
          />
          {form.formState.errors.apiKey ? (
            <p className="text-sm text-destructive">{form.formState.errors.apiKey.message}</p>
          ) : null}

          <Controller
            control={form.control}
            name="analysisDepth"
            render={({ field }) => (
              <label className="flex gap-3 rounded-md border bg-muted/30 p-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 size-4 accent-teal-700"
                  checked={field.value === "expanded"}
                  disabled={isFormDisabled}
                  onChange={(event) => field.onChange(event.target.checked ? "expanded" : "standard")}
                />
                <span className="space-y-1">
                  <span className="block font-medium">Expanded coverage</span>
                  <span className="block text-muted-foreground">
                    Use more of this OpenAI key with higher file, character, and finding caps. Hard
                    safety caps still apply to prevent runaway spend.
                  </span>
                </span>
              </label>
            )}
          />

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Label>Review agents</Label>
              <span className="text-xs font-medium text-muted-foreground">
                {selectedAgentCount} of {DEFAULT_ANALYSIS_AGENT_IDS.length} selected
              </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                className={cn(
                  "flex min-h-24 items-start gap-3 rounded-md border bg-background p-3 text-left transition-colors",
                  analysisMode === "full" && isFullAnalysisSelected
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/40",
                )}
                disabled={isFormDisabled}
                onClick={chooseFullAnalysis}
              >
                <CheckCircle2
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    analysisMode === "full" && isFullAnalysisSelected
                      ? "text-primary"
                      : "text-muted-foreground",
                  )}
                />
                <span className="space-y-1">
                  <span className="block text-sm font-medium">Full analysis</span>
                  <span className="block text-xs leading-5 text-muted-foreground">
                    Run every review agent for the broadest production-readiness report.
                  </span>
                </span>
              </button>

              <button
                type="button"
                className={cn(
                  "flex min-h-24 items-start gap-3 rounded-md border bg-background p-3 text-left transition-colors",
                  analysisMode === "custom" ? "border-primary bg-primary/5" : "hover:bg-muted/40",
                )}
                disabled={isFormDisabled}
                onClick={chooseCustomAnalysis}
              >
                <SlidersHorizontal
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    analysisMode === "custom" ? "text-primary" : "text-muted-foreground",
                  )}
                />
                <span className="space-y-1">
                  <span className="block text-sm font-medium">Custom selection</span>
                  <span className="block text-xs leading-5 text-muted-foreground">
                    Pick the agents that match the repository questions you want answered.
                  </span>
                </span>
              </button>
            </div>

            {analysisMode === "custom" ? (
              <div className="grid gap-2">
                {SELECTABLE_ANALYSIS_AGENTS.map((agent) => {
                  const Icon = agentIcons[agent.id];
                  const checked = selectedAgentSet.has(agent.id);
                  const canToggle = !isFormDisabled && (!checked || selectedAgentCount > 1);

                  return (
                    <label
                      key={agent.id}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-md border bg-background p-3 text-sm transition-colors",
                        checked ? "border-primary bg-primary/5" : "hover:bg-muted/40",
                        !canToggle && "cursor-not-allowed opacity-70",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        disabled={!canToggle}
                        onChange={() => toggleAgent(agent.id)}
                      />
                      <Icon
                        className={cn(
                          "mt-0.5 size-4 shrink-0",
                          checked ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                      <span className="min-w-0 flex-1 space-y-1">
                        <span className="block font-medium">{agent.label}</span>
                        <span className="block text-xs leading-5 text-muted-foreground">
                          {agent.description}
                        </span>
                      </span>
                      <span
                        aria-hidden="true"
                        className={cn(
                          "mt-0.5 grid size-4 shrink-0 place-items-center rounded-sm border",
                          checked ? "border-primary bg-primary text-primary-foreground" : "bg-background",
                        )}
                      >
                        {checked ? <CheckCircle2 className="size-3" /> : null}
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : null}

            {form.formState.errors.agentIds ? (
              <p className="text-sm text-destructive">{form.formState.errors.agentIds.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="repoPicker">Your GitHub repositories</Label>
            <select
              id="repoPicker"
              className="w-full rounded-md border bg-background p-2 text-sm"
              disabled={isFormDisabled || reposLoading || repoOptions.length === 0}
              onChange={(event) => {
                if (event.target.value) {
                  form.setValue("repoUrl", event.target.value, { shouldValidate: true });
                }
              }}
            >
              <option value="">{reposLoading ? "Loading repositories..." : "Select a repository (optional)"}</option>
              {repoOptions.map((repo) => (
                <option key={repo.id} value={repo.url}>
                  {repo.fullName}{repo.private ? " (private)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="repoUrl">GitHub repository</Label>
            <div className="relative">
              <Github className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="repoUrl"
                placeholder="owner/repo or https://github.com/owner/repo"
                className="pl-9"
                disabled={isFormDisabled}
                {...form.register("repoUrl")}
              />
            </div>
            {form.formState.errors.repoUrl ? (
              <p className="text-sm text-destructive">{form.formState.errors.repoUrl.message}</p>
            ) : null}
          </div>

          <AnalysisStatus
            status={submitError ? "error" : isAnalysisActive || isSubmitting ? "running" : statusMessage ? "success" : "idle"}
            message={submitError ?? statusMessage ?? undefined}
            onCancel={isAnalysisActive ? cancelActiveJob : undefined}
          />

          {connectGithubPrompt ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="mb-2">This repository is private. Connect GitHub App access and then retry.</p>
              <Button asChild type="button" variant="outline">
                <a href={connectGithubUrl}>Connect GitHub App</a>
              </Button>
            </div>
          ) : null}

          <AnalysisWorkflow steps={workflowSteps} visible={showWorkflow} />

          <Button className="w-full" type="submit" disabled={isFormDisabled}>
            <SearchCode className="size-4" />
            {isFormDisabled ? "Analysis in progress" : "Analyze Repository"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
