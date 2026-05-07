import { FindingCard } from "@/components/reports/FindingCard";
import type { ReportView } from "@/lib/db/reports";

export function FindingsTable({ findings }: { findings: ReportView["findings"] }) {
  if (findings.length === 0) {
    return (
      <section className="rounded-md border p-6">
        <h2 className="text-xl font-semibold">Top findings</h2>
        <p className="mt-2 text-muted-foreground">No findings were generated for this report.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Top findings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Severity-ranked issues with confidence and practical fixes.
        </p>
      </div>
      <div className="grid gap-4">
        {findings.map((finding) => (
          <FindingCard key={finding.id} finding={finding} />
        ))}
      </div>
    </section>
  );
}
