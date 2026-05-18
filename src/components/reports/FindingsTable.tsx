import { FindingCard } from "@/components/reports/FindingCard";
import { Badge } from "@/components/ui/badge";
import type { ReportView } from "@/lib/db/reports";

const CATEGORY_ORDER = ["security", "architecture", "maintainability", "performance", "testing"] as const;

const CATEGORY_LABELS: Record<string, string> = {
  architecture: "Architecture",
  security: "Security",
  performance: "Performance",
  maintainability: "Maintainability",
  testing: "Testing",
};

function groupedFindings(findings: ReportView["findings"]) {
  const groups = new Map<string, ReportView["findings"]>();

  findings.forEach((finding) => {
    const existing = groups.get(finding.category) ?? [];
    existing.push(finding);
    groups.set(finding.category, existing);
  });

  return Array.from(groups.entries()).sort(([left], [right]) => {
    const leftIndex = CATEGORY_ORDER.indexOf(left as (typeof CATEGORY_ORDER)[number]);
    const rightIndex = CATEGORY_ORDER.indexOf(right as (typeof CATEGORY_ORDER)[number]);

    if (leftIndex !== -1 || rightIndex !== -1) {
      return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) -
        (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
    }

    return left.localeCompare(right);
  });
}

export function FindingsTable({ findings }: { findings: ReportView["findings"] }) {
  if (findings.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No findings were generated for this report.</p>
    );
  }

  return (
    <div className="space-y-6">
      {groupedFindings(findings).map(([category, categoryFindings]) => (
        <section key={category} className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold">
              {CATEGORY_LABELS[category] ?? category}
            </h3>
            <Badge variant="outline">
              {categoryFindings.length} {categoryFindings.length === 1 ? "issue" : "issues"}
            </Badge>
          </div>
          <div className="grid gap-4">
            {categoryFindings.map((finding) => (
              <FindingCard key={finding.id} finding={finding} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
