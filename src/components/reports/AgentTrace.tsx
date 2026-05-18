import { CircleCheck, CircleDashed, CircleX } from "lucide-react";
import type { AgentTraceStep } from "@/lib/agents/types";

function TraceIcon({ status }: { status: AgentTraceStep["status"] }) {
  if (status === "completed") return <CircleCheck className="size-4 text-primary" />;
  if (status === "failed") return <CircleX className="size-4 text-destructive" />;
  return <CircleDashed className="size-4 text-muted-foreground" />;
}

export function AgentTrace({ trace }: { trace: AgentTraceStep[] }) {
  return (
    <div className="space-y-3">
      {trace.map((step, index) => (
        <div key={`${step.agent}-${index}`} className="flex items-start gap-3 rounded-md border px-3 py-3">
          <TraceIcon status={step.status} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{step.agent}</p>
              <span className="text-xs text-muted-foreground">{step.status}</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{step.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
