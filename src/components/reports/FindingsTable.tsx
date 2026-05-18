"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { FindingCard } from "@/components/reports/FindingCard";
import { Badge } from "@/components/ui/badge";
import type { ReportView } from "@/lib/db/reports";
import { cn } from "@/lib/utils";

const CATEGORY_ORDER = ["security", "architecture", "maintainability", "performance", "testing"] as const;

const CATEGORY_LABELS: Record<string, string> = {
  architecture: "Architecture",
  security: "Security",
  performance: "Performance",
  maintainability: "Maintainability",
  testing: "Testing",
};

const CATEGORY_STYLES: Record<
  string,
  {
    border: string;
    header: string;
    icon: string;
    meta: string;
  }
> = {
  architecture: {
    border: "border-l-teal-600",
    header: "bg-teal-50/70 hover:bg-teal-50",
    icon: "text-teal-700",
    meta: "text-teal-900",
  },
  security: {
    border: "border-l-red-600",
    header: "bg-red-50/70 hover:bg-red-50",
    icon: "text-red-700",
    meta: "text-red-900",
  },
  performance: {
    border: "border-l-sky-600",
    header: "bg-sky-50/70 hover:bg-sky-50",
    icon: "text-sky-700",
    meta: "text-sky-900",
  },
  maintainability: {
    border: "border-l-indigo-600",
    header: "bg-indigo-50/70 hover:bg-indigo-50",
    icon: "text-indigo-700",
    meta: "text-indigo-900",
  },
  testing: {
    border: "border-l-amber-600",
    header: "bg-amber-50/70 hover:bg-amber-50",
    icon: "text-amber-700",
    meta: "text-amber-900",
  },
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

function severitySummary(findings: ReportView["findings"]) {
  const counts: Record<string, number> = {};

  findings.forEach((finding) => {
    counts[finding.severity] = (counts[finding.severity] ?? 0) + 1;
  });

  return ["critical", "high", "medium", "low"]
    .filter((severity) => counts[severity])
    .map((severity) => `${counts[severity]} ${severity}`)
    .join(" / ");
}

function shouldOpenByDefault(findings: ReportView["findings"], index: number) {
  return (
    index === 0 ||
    findings.some((finding) => finding.severity === "critical" || finding.severity === "high")
  );
}

function FindingsCategoryAccordion({
  category,
  findings,
  defaultOpen,
}: {
  category: string;
  findings: ReportView["findings"];
  defaultOpen: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const styles = CATEGORY_STYLES[category] ?? {
    border: "border-l-slate-500",
    header: "bg-slate-50/80 hover:bg-slate-50",
    icon: "text-slate-700",
    meta: "text-slate-900",
  };
  const severityText = severitySummary(findings);

  return (
    <section
      className={cn(
        "overflow-hidden rounded-md border border-l-4 bg-background transition-colors",
        isOpen ? "border-slate-300" : "border-border hover:border-slate-300",
        styles.border,
      )}
    >
      <button
        type="button"
        className={cn(
          "flex w-full items-start justify-between gap-4 px-4 py-3 text-left transition-colors",
          styles.header,
        )}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold leading-6">
              {CATEGORY_LABELS[category] ?? category}
            </h3>
            <Badge variant="outline">
              {findings.length} {findings.length === 1 ? "issue" : "issues"}
            </Badge>
          </div>
          {severityText ? (
            <p className={cn("text-xs font-medium leading-5", styles.meta)}>{severityText}</p>
          ) : null}
        </div>
        <ChevronDown
          className={cn(
            "mt-0.5 size-5 shrink-0 transition-transform duration-300 ease-out",
            styles.icon,
            isOpen && "rotate-180",
          )}
        />
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out",
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div
            className={cn(
              "grid gap-4 p-4 transition-opacity duration-300 ease-out",
              isOpen ? "opacity-100" : "opacity-0",
            )}
          >
            {findings.map((finding) => (
              <FindingCard key={finding.id} finding={finding} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function FindingsTable({ findings }: { findings: ReportView["findings"] }) {
  if (findings.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No findings were generated for this report.</p>
    );
  }

  return (
    <div className="space-y-3">
      {groupedFindings(findings).map(([category, categoryFindings], index) => (
        <FindingsCategoryAccordion
          key={category}
          category={category}
          findings={categoryFindings}
          defaultOpen={shouldOpenByDefault(categoryFindings, index)}
        />
      ))}
    </div>
  );
}
