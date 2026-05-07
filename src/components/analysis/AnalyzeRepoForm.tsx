"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Github, SearchCode } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import type { AnalysisProgressEvent } from "@/lib/analysis/progress";
import { analyzeSchema, type AnalyzeInput } from "@/lib/validators/analyzeSchema";
import { ApiKeyInput } from "@/components/analysis/ApiKeyInput";
import { AnalysisStatus } from "@/components/analysis/AnalysisStatus";
import {
  AnalysisWorkflow,
  createInitialWorkflowSteps,
  type AnalysisWorkflowStepState,
} from "@/components/analysis/AnalysisWorkflow";
import { ProviderSelector } from "@/components/analysis/ProviderSelector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ApiError = {
  error?: {
    code: string;
    message: string;
  };
  reportId?: string;
};

export function AnalyzeRepoForm() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [workflowSteps, setWorkflowSteps] = useState<AnalysisWorkflowStepState[]>(
    createInitialWorkflowSteps,
  );
  const [showWorkflow, setShowWorkflow] = useState(false);
  const form = useForm<AnalyzeInput>({
    resolver: zodResolver(analyzeSchema),
    defaultValues: {
      provider: "openai",
      apiKey: "",
      analysisDepth: "standard",
      repoUrl: "",
    },
  });

  const isSubmitting = form.formState.isSubmitting;

  function applyProgressEvent(event: AnalysisProgressEvent) {
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
      setStatusMessage(event.message);
      return;
    }

    if (event.type === "complete") {
      setStatusMessage(event.message);
      router.push(`/reports/${event.reportId}`);
      return;
    }

    setStatusMessage(null);
    setSubmitError(event.message);
  }

  async function handleJsonFallback(response: Response) {
    const payload = (await response.json()) as ApiError & { reportId?: string };

    if (!response.ok) {
      setStatusMessage(null);
      setSubmitError(payload.error?.message ?? "Analysis failed. Check the inputs and try again.");
      return;
    }

    if (payload.reportId) {
      setStatusMessage("Report created. Opening results...");
      router.push(`/reports/${payload.reportId}`);
    }
  }

  async function readProgressStream(response: Response) {
    if (!response.body) {
      await handleJsonFallback(response);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }

        applyProgressEvent(JSON.parse(line) as AnalysisProgressEvent);
      }

      if (done) {
        break;
      }
    }

    if (buffer.trim()) {
      applyProgressEvent(JSON.parse(buffer) as AnalysisProgressEvent);
    }
  }

  async function onSubmit(values: AnalyzeInput) {
    setSubmitError(null);
    setStatusMessage("Validating request...");
    setWorkflowSteps(createInitialWorkflowSteps());
    setShowWorkflow(true);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          Accept: "application/x-ndjson",
          "Content-Type": "application/json",
          "X-RepoVitals-Stream": "1",
        },
        body: JSON.stringify(values),
      });

      const contentType = response.headers.get("content-type") ?? "";

      if (!response.ok || !contentType.includes("application/x-ndjson")) {
        await handleJsonFallback(response);
        return;
      }

      await readProgressStream(response);
    } catch (error) {
      setStatusMessage(null);
      setSubmitError(error instanceof Error ? error.message : "Analysis failed. Check the inputs and try again.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Analyze a public repository</CardTitle>
        <CardDescription>Use a provider key for this one run. RepoVitals does not persist it.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
          <Controller
            control={form.control}
            name="provider"
            render={({ field }) => (
              <ProviderSelector value={field.value} onChange={field.onChange} disabled={isSubmitting} />
            )}
          />

          <Controller
            control={form.control}
            name="apiKey"
            render={({ field }) => (
              <ApiKeyInput value={field.value} onChange={field.onChange} disabled={isSubmitting} />
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
                  disabled={isSubmitting}
                  onChange={(event) => field.onChange(event.target.checked ? "expanded" : "standard")}
                />
                <span className="space-y-1">
                  <span className="block font-medium">Expanded coverage</span>
                  <span className="block text-muted-foreground">
                    Use more of this provider key with higher file, character, and finding caps. Hard
                    safety caps still apply to prevent runaway spend.
                  </span>
                </span>
              </label>
            )}
          />

          <div className="space-y-2">
            <Label htmlFor="repoUrl">GitHub repository</Label>
            <div className="relative">
              <Github className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="repoUrl"
                placeholder="owner/repo or https://github.com/owner/repo"
                className="pl-9"
                disabled={isSubmitting}
                {...form.register("repoUrl")}
              />
            </div>
            {form.formState.errors.repoUrl ? (
              <p className="text-sm text-destructive">{form.formState.errors.repoUrl.message}</p>
            ) : null}
          </div>

          <AnalysisStatus
            status={submitError ? "error" : isSubmitting ? "running" : statusMessage ? "success" : "idle"}
            message={submitError ?? statusMessage ?? undefined}
          />

          <AnalysisWorkflow steps={workflowSteps} visible={showWorkflow} />

          <Button className="w-full" type="submit" disabled={isSubmitting}>
            <SearchCode className="size-4" />
            {isSubmitting ? "Analyzing repository" : "Analyze Repository"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
