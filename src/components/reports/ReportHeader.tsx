import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ReportView } from "@/lib/db/reports";

export function ReportHeader({ report }: { report: ReportView }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={report.status === "completed" ? "low" : report.status === "failed" ? "critical" : "default"}>
          {report.status}
        </Badge>
        <span className="text-sm text-muted-foreground">
          Created {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(report.createdAt)}
        </span>
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold md:text-4xl">
            {report.repository.owner}/{report.repository.name}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Default branch: {report.repository.defaultBranch ?? "unknown"}
          </p>
        </div>
        <Link
          href={report.repository.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          Open repository
          <ExternalLink className="size-4" />
        </Link>
      </div>
    </section>
  );
}
