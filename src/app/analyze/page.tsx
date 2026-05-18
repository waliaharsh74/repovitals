import { AnalyzeRepoForm } from "@/components/analysis/AnalyzeRepoForm";

export default function AnalyzePage() {
  return (
    <main className="border-t bg-[linear-gradient(180deg,#f8faf9_0%,#ffffff_42%)]">
      <div className="container space-y-5 py-6 md:py-8">
        <section className="rv-reveal-up flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-primary">New analysis</p>
            <h1 className="text-3xl font-semibold tracking-normal md:text-4xl">
              Analyze repository
            </h1>
          </div>
          <p className="max-w-xl text-sm leading-6 text-muted-foreground md:text-right">
            Choose a source, tune the review scope, and start the run from one focused workspace.
          </p>
        </section>
        <AnalyzeRepoForm />
      </div>
    </main>
  );
}
