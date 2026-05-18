"use client";

import type { ReactNode } from "react";
import { useState } from "react";
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
  contentClassName,
}: {
  title: string;
  description?: string;
  badge?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section
      className={cn(
        "overflow-hidden rounded-md border bg-card text-card-foreground shadow-sm transition-colors",
        isOpen ? "border-slate-300" : "border-border hover:border-slate-300",
        className,
      )}
    >
      <button
        type="button"
        className="flex w-full items-start justify-between gap-4 border-l-4 border-l-primary/70 bg-muted/20 p-5 text-left transition-colors hover:bg-muted/35"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold leading-none">{title}</span>
            {badge ? <Badge variant="outline">{badge}</Badge> : null}
          </div>
          {description ? (
            <span className="block text-sm leading-5 text-muted-foreground">{description}</span>
          ) : null}
        </div>
        <ChevronDown
          className={cn(
            "mt-0.5 size-5 shrink-0 text-muted-foreground transition-transform duration-300 ease-out",
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
              "border-t p-5 transition-opacity duration-300 ease-out",
              isOpen ? "opacity-100" : "opacity-0",
              contentClassName,
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
