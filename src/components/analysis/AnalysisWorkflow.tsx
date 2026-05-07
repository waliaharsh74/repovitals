"use client";

import { AlertCircle, CheckCircle2, Circle, Loader2 } from "lucide-react";
import {
  ANALYSIS_WORKFLOW_STEPS,
  type AnalysisProgressStatus,
  type AnalysisWorkflowStepId,
} from "@/lib/analysis/progress";
import { cn } from "@/lib/utils";

export type AnalysisWorkflowStepState = {
  id: AnalysisWorkflowStepId;
  label: string;
  description: string;
  status: AnalysisProgressStatus;
  message?: string;
  detail?: string;
};

export function createInitialWorkflowSteps(): AnalysisWorkflowStepState[] {
  return ANALYSIS_WORKFLOW_STEPS.map((step) => ({
    ...step,
    status: "pending",
  }));
}

export function AnalysisWorkflow({
  steps,
  visible,
}: {
  steps: AnalysisWorkflowStepState[];
  visible: boolean;
}) {
  if (!visible) {
    return null;
  }

  return (
    <div className="rounded-md border bg-background">
      <div className="border-b px-4 py-3">
        <p className="text-sm font-medium">Analysis workflow</p>
      </div>
      <ol className="divide-y">
        {steps.map((step) => {
          const Icon =
            step.status === "completed"
              ? CheckCircle2
              : step.status === "failed"
                ? AlertCircle
                : step.status === "running"
                  ? Loader2
                  : Circle;

          return (
            <li key={step.id} className="flex gap-3 px-4 py-3">
              <Icon
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  step.status === "completed" && "text-emerald-600",
                  step.status === "failed" && "text-destructive",
                  step.status === "running" && "animate-spin text-teal-700",
                  step.status === "pending" && "text-muted-foreground",
                )}
              />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium leading-none">{step.label}</p>
                  <span
                    className={cn(
                      "rounded-sm px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-normal",
                      step.status === "completed" && "bg-emerald-50 text-emerald-700",
                      step.status === "failed" && "bg-red-50 text-red-700",
                      step.status === "running" && "bg-teal-50 text-teal-800",
                      step.status === "pending" && "bg-muted text-muted-foreground",
                    )}
                  >
                    {step.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{step.message ?? step.description}</p>
                {step.detail ? <p className="text-xs text-muted-foreground">{step.detail}</p> : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
