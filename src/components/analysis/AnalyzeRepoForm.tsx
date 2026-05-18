"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CheckCircle2,
  Gauge,
  Github,
  Lock,
  Network,
  Search,
  SearchCode,
  ShieldAlert,
  SlidersHorizontal,
  TestTube2,
  X,
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
import { Card, CardContent } from "@/components/ui/card";
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
  const [repoSearchQuery, setRepoSearchQuery] = useState("");
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

  const filteredRepoOptions = useMemo(() => {
    const query = repoSearchQuery.trim().toLowerCase();
    if (!query) {
      return repoOptions;
    }

    return repoOptions.filter((repo) =>
      [repo.fullName, repo.url].some((value) => value.toLowerCase().includes(query)),
    );
  }, [repoOptions, repoSearchQuery]);

  const isSubmitting = form.formState.isSubmitting;
  const isAnalysisActive = analysisState === "queued" || analysisState === "running";
  const isFormDisabled = isSubmitting || isAnalysisActive;
  const selectedAgentIds = form.watch("agentIds") ?? DEFAULT_ANALYSIS_AGENT_IDS;
  const selectedAgentSet = new Set(selectedAgentIds);
  const selectedAgentCount = selectedAgentSet.size;
  const isFullAnalysisSelected = areAllAnalysisAgentsSelected(selectedAgentIds);
  const selectedRepoUrl = form.watch("repoUrl");

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

  function selectRepository(repo: GithubRepoOption) {
    form.setValue("repoUrl", repo.url, {
      shouldDirty: true,
      shouldValidate: true,
    });
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
    <Card className="rv-reveal-up rv-reveal-delay-1 overflow-hidden shadow-sm">
      <CardContent className="p-0">
        <form className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_380px]" onSubmit={form.handleSubmit(onSubmit)}>
          <section className="space-y-5 p-4 sm:p-5 lg:p-6">
            <div className="space-y-2">
              <div className="rounded-md border bg-background p-4">
                <Controller
                  control={form.control}
                  name="apiKey"
                  render={({ field }) => (
                    <ApiKeyInput value={field.value} onChange={field.onChange} disabled={isFormDisabled} />
                  )}
                />
                {form.formState.errors.apiKey ? (
                  <p className="mt-2 text-sm text-destructive">{form.formState.errors.apiKey.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="repoUrl">Repository</Label>
                  <span className="text-xs font-medium text-muted-foreground">Required</span>
                </div>
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

            
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label htmlFor="repoSearch">GitHub repositories</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Select one to fill the repository field.
                  </p>
                </div>
                {repoOptions.length ? (
                  <span className="text-xs font-medium text-muted-foreground">
                    {filteredRepoOptions.length} of {repoOptions.length}
                  </span>
                ) : null}
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="repoSearch"
                  type="search"
                  placeholder="Search repositories"
                  className="pl-9 pr-9"
                  value={repoSearchQuery}
                  disabled={isFormDisabled || reposLoading || repoOptions.length === 0}
                  onChange={(event) => setRepoSearchQuery(event.target.value)}
                />
                {repoSearchQuery ? (
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                    disabled={isFormDisabled}
                    aria-label="Clear repository search"
                    onClick={() => setRepoSearchQuery("")}
                  >
                    <X className="size-4" />
                  </button>
                ) : null}
              </div>
              <div className="overflow-hidden rounded-md border bg-background shadow-sm">
                {reposLoading ? (
                  <div className="space-y-2 p-3">
                    {[0, 1, 2].map((item) => (
                      <div key={item} className="h-12 rounded-md bg-muted rv-soft-pulse" />
                    ))}
                  </div>
                ) : repoOptions.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">
                    No GitHub repositories are available for this account.
                  </div>
                ) : filteredRepoOptions.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">
                    No repositories match this search.
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto p-1" aria-label="GitHub repositories">
                    {filteredRepoOptions.map((repo) => {
                      const selected = selectedRepoUrl === repo.url;

                      return (
                        <button
                          key={repo.id}
                          type="button"
                          className={cn(
                            "group flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left transition-all duration-200",
                            selected
                              ? "bg-primary/10 text-foreground"
                              : "hover:bg-muted/60 hover:shadow-sm",
                          )}
                          disabled={isFormDisabled}
                          aria-pressed={selected}
                          onClick={() => selectRepository(repo)}
                        >
                          <Github
                            className={cn(
                              "mt-0.5 size-4 shrink-0 transition-colors",
                              selected
                                ? "text-primary"
                                : "text-muted-foreground group-hover:text-foreground",
                            )}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{repo.fullName}</span>
                            <span className="block truncate text-xs text-muted-foreground">{repo.url}</span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            {repo.private ? (
                              <span className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium">
                                <Lock className="size-3" />
                                Private
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium">
                                Public
                              </span>
                            )}
                            {selected ? <CheckCircle2 className="size-4 text-primary" /> : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>

          <aside className="border-t bg-slate-50/70 p-4 sm:p-5 lg:border-l lg:border-t-0 lg:p-6">
            <div className="space-y-5 lg:sticky lg:top-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Review scope</p>
                    <p className="mt-1 text-xs text-muted-foreground">Tune breadth before the run.</p>
                  </div>
                  <span className="rounded-md border bg-background px-2 py-1 text-xs font-medium text-muted-foreground">
                    {selectedAgentCount}/{DEFAULT_ANALYSIS_AGENT_IDS.length}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className={cn(
                      "flex min-h-[72px] flex-col justify-between rounded-md border bg-background p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm",
                      analysisMode === "full" && isFullAnalysisSelected && "border-primary bg-primary/5",
                    )}
                    disabled={isFormDisabled}
                    aria-pressed={analysisMode === "full" && isFullAnalysisSelected}
                    onClick={chooseFullAnalysis}
                  >
                    <CheckCircle2
                      className={cn(
                        "size-4",
                        analysisMode === "full" && isFullAnalysisSelected
                          ? "text-primary"
                          : "text-muted-foreground",
                      )}
                    />
                    <span className="text-sm font-medium">Full</span>
                  </button>

                  <button
                    type="button"
                    className={cn(
                      "flex min-h-[72px] flex-col justify-between rounded-md border bg-background p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm",
                      analysisMode === "custom" && "border-primary bg-primary/5",
                    )}
                    disabled={isFormDisabled}
                    aria-pressed={analysisMode === "custom"}
                    onClick={chooseCustomAnalysis}
                  >
                    <SlidersHorizontal
                      className={cn(
                        "size-4",
                        analysisMode === "custom" ? "text-primary" : "text-muted-foreground",
                      )}
                    />
                    <span className="text-sm font-medium">Custom</span>
                  </button>
                </div>

                {analysisMode === "custom" ? (
                  <div className="rv-reveal-up grid grid-cols-2 gap-2">
                    {SELECTABLE_ANALYSIS_AGENTS.map((agent) => {
                      const Icon = agentIcons[agent.id];
                      const checked = selectedAgentSet.has(agent.id);
                      const canToggle = !isFormDisabled && (!checked || selectedAgentCount > 1);

                      return (
                        <label
                          key={agent.id}
                          className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2.5 text-sm transition-all duration-200 hover:border-primary/40 hover:bg-muted/40",
                            checked && "border-primary bg-primary/5",
                            !canToggle && "cursor-not-allowed opacity-70",
                          )}
                          title={agent.description}
                          aria-label={`${agent.label}. ${agent.description}`}
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
                              "size-4 shrink-0",
                              checked ? "text-primary" : "text-muted-foreground",
                            )}
                          />
                          <span className="min-w-0 flex-1 truncate font-medium">{agent.label}</span>
                          <span
                            aria-hidden="true"
                            className={cn(
                              "grid size-4 shrink-0 place-items-center rounded-sm border",
                              checked
                                ? "border-primary bg-primary text-primary-foreground"
                                : "bg-background",
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

              <Controller
                control={form.control}
                name="analysisDepth"
                render={({ field }) => (
                  <label className="flex gap-3 rounded-md border bg-background p-3 text-sm transition-colors hover:bg-muted/30">
                    <input
                      type="checkbox"
                      className="mt-1 size-4 accent-teal-700"
                      checked={field.value === "expanded"}
                      disabled={isFormDisabled}
                      onChange={(event) => field.onChange(event.target.checked ? "expanded" : "standard")}
                    />
                    <span className="space-y-1">
                      <span className="block font-medium">Expanded coverage</span>
                      <span className="block text-xs leading-5 text-muted-foreground">
                        Higher file, character, and finding caps for deeper reviews.
                      </span>
                    </span>
                  </label>
                )}
              />

              <Button className="h-11 w-full shadow-sm transition-transform active:translate-y-px" type="submit" disabled={isFormDisabled}>
                <SearchCode className="size-4" />
                {isFormDisabled ? "Analysis in progress" : "Analyze Repository"}
              </Button>

              <AnalysisStatus
                status={
                  submitError
                    ? "error"
                    : isAnalysisActive || isSubmitting
                      ? "running"
                      : statusMessage
                        ? "success"
                        : "idle"
                }
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
            </div>
          </aside>
        </form>
      </CardContent>
    </Card>
  );
}
