import { AlertCircle, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function AnalysisStatus({
  status,
  message,
  onCancel,
}: {
  status: "idle" | "running" | "error" | "success";
  message?: string;
  onCancel?: () => void;
}) {
  if (status === "idle") {
    return null;
  }

  const Icon = status === "running" ? Loader2 : status === "error" ? AlertCircle : CheckCircle2;

  return (
    <Alert
      className={
        status === "error"
          ? "border-red-200 bg-red-50 text-red-800"
          : status === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-teal-200 bg-teal-50 text-teal-900"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Icon className={status === "running" ? "mt-0.5 size-4 animate-spin" : "mt-0.5 size-4"} />
          <p>{message}</p>
        </div>
        {onCancel ? (
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            <XCircle className="size-4" />
            Cancel
          </Button>
        ) : null}
      </div>
    </Alert>
  );
}
