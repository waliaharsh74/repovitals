import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function ReportAccordionSection({
  title,
  description,
  badge,
  defaultOpen = true,
  children,
  className,
}: {
  title: string;
  description?: string;
  badge?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details
      className={cn("group rounded-md border bg-card text-card-foreground", className)}
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 p-5 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold leading-none">{title}</span>
            {badge ? <Badge variant="outline">{badge}</Badge> : null}
          </div>
          {description ? (
            <span className="block text-sm leading-5 text-muted-foreground">{description}</span>
          ) : null}
        </div>
        <ChevronDown className="mt-0.5 size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t p-5">{children}</div>
    </details>
  );
}
