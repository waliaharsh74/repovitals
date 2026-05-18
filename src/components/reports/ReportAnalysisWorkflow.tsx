"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AnalysisJobSnapshot,
  AnalysisJobStatus,
  AnalysisProgressEvent,
} from "@/lib/analysis/progress";
import { AnalysisStatus } from "@/components/analysis/AnalysisStatus";
import {
  AnalysisWorkflow,
  createInitialWorkflowSteps,
  mergeWorkflowProgressRecords,
  type AnalysisWorkflowStepState,
} from "@/components/analysis/AnalysisWorkflow";

const TERMINAL_STATUSES = new Set<AnalysisJobStatus>(["completed", "failed", "cancelled"]);

function statusMessage(snapshot: AnalysisJobSnapshot): string {
  if (snapshot.errorMessage) {
    return snapshot.errorMessage;
  }

  return statusMessageForStatus(snapshot.status);
}

function statusMessageForStatus(status: AnalysisJobStatus): string {
  if (status === "pending") {
    return "Analysis queued. Waiting for the worker...";
  }

  if (status === "running") {
    return "Analysis is running...";
  }

  if (status === "completed") {
    return "Report created. Loading results...";
  }

  return status === "cancelled" ? "Analysis was cancelled." : "Analysis failed.";
}

function workflowStepsFromSnapshot(snapshot: AnalysisJobSnapshot): AnalysisWorkflowStepState[] {
  return mergeWorkflowProgressRecords(createInitialWorkflowSteps(), snapshot.progress);
}

export function ReportAnalysisWorkflow({
  initialSnapshot,
}: {
  initialSnapshot: AnalysisJobSnapshot | null;
}) {
  const router = useRouter();
  const eventSourceRef = useRef<EventSource | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [jobStatus, setJobStatus] = useState<AnalysisJobStatus | null>(
    initialSnapshot?.status ?? null,
  );
  const [message, setMessage] = useState<string | null>(
    initialSnapshot ? statusMessage(initialSnapshot) : null,
  );
  const [isCancelling, setIsCancelling] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [workflowSteps, setWorkflowSteps] = useState<AnalysisWorkflowStepState[]>(
    initialSnapshot ? () => workflowStepsFromSnapshot(initialSnapshot) : createInitialWorkflowSteps,
  );

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!initialSnapshot) {
      return;
    }

    setJobStatus(initialSnapshot.status);
    setMessage(statusMessage(initialSnapshot));
    setIsCancelling(false);
    setErrorMessage(null);
    setWorkflowSteps(workflowStepsFromSnapshot(initialSnapshot));

    if (TERMINAL_STATUSES.has(initialSnapshot.status)) {
      return;
    }

    eventSourceRef.current?.close();
    const source = new EventSource(
      `/api/analyze/jobs/${encodeURIComponent(initialSnapshot.jobId)}/events`,
    );
    eventSourceRef.current = source;

    function closeSource() {
      source.close();
      if (eventSourceRef.current === source) {
        eventSourceRef.current = null;
      }
    }

    function refreshReport() {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }

      refreshTimerRef.current = setTimeout(() => {
        router.refresh();
      }, 250);
    }

    function applyProgressEvent(event: AnalysisProgressEvent) {
      if (event.type === "snapshot") {
        setWorkflowSteps((current) => mergeWorkflowProgressRecords(current, event.steps));
        setJobStatus(event.status);
        setErrorMessage(null);
        if (event.status !== "pending" && event.status !== "running") {
          setIsCancelling(false);
        }
        setMessage(event.message ?? statusMessageForStatus(event.status));
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
                  startedAt: event.startedAt,
                  completedAt: event.completedAt,
                  failedAt: event.failedAt,
                  updatedAt: event.updatedAt,
                }
              : step,
          ),
        );
        setJobStatus("running");
        setMessage(event.message);
        return;
      }

      if (event.type === "complete") {
        closeSource();
        setJobStatus("completed");
        setIsCancelling(false);
        setErrorMessage(null);
        setMessage(event.message);
        refreshReport();
        return;
      }

      closeSource();
      setJobStatus("failed");
      setIsCancelling(false);
      setErrorMessage(event.message);
    }

    source.addEventListener("snapshot", (event) => {
      applyProgressEvent(JSON.parse(event.data) as AnalysisProgressEvent);
    });
    source.addEventListener("complete", (event) => {
      applyProgressEvent(JSON.parse(event.data) as AnalysisProgressEvent);
    });
    source.addEventListener("job-error", (event) => {
      applyProgressEvent(JSON.parse(event.data) as AnalysisProgressEvent);
    });
    source.onerror = () => {
      closeSource();
      setJobStatus("failed");
      setIsCancelling(false);
      setErrorMessage("Lost the analysis progress connection. Refresh this page to reconnect.");
    };

    return closeSource;
  }, [initialSnapshot, router]);

  if (!initialSnapshot) {
    return (
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Report is still running</h2>
        <p className="text-sm text-muted-foreground">
          No active analysis job was found for this report.
        </p>
      </section>
    );
  }

  const canCancel = Boolean(
    initialSnapshot &&
      !errorMessage &&
      !isCancelling &&
      (jobStatus === "pending" || jobStatus === "running"),
  );

  async function cancelAnalysis() {
    if (!initialSnapshot || !canCancel) {
      return;
    }

    setIsCancelling(true);
    setMessage("Cancelling analysis...");

    try {
      const response = await fetch(`/api/analyze/jobs/${encodeURIComponent(initialSnapshot.jobId)}/cancel`, {
        method: "POST",
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: { message?: string } };
        throw new Error(payload.error?.message ?? "Could not cancel this analysis.");
      }

      router.refresh();
    } catch (error) {
      setIsCancelling(false);
      setErrorMessage(error instanceof Error ? error.message : "Could not cancel this analysis.");
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Report is still running</h2>
      <AnalysisStatus
        status={errorMessage ? "error" : jobStatus === "completed" ? "success" : "running"}
        message={errorMessage ?? message ?? undefined}
        onCancel={canCancel ? cancelAnalysis : undefined}
      />
      <AnalysisWorkflow steps={workflowSteps} visible />
    </section>
  );
}
