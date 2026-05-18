import { ShieldCheck } from "lucide-react";
import { AnalyzeRepoForm } from "@/components/analysis/AnalyzeRepoForm";

export default function AnalyzePage() {
  return (
    <main className="container grid gap-8 py-10 lg:grid-cols-[1fr_420px]">
      <section className="space-y-6">
        <div className="inline-flex items-center gap-2 rounded-md border bg-muted px-3 py-1 text-sm text-muted-foreground">
          <ShieldCheck className="size-4 text-primary" />
          Public repositories only for MVP
        </div>
        <div className="max-w-3xl space-y-4">
          <h1 className="text-4xl font-semibold tracking-normal md:text-5xl">
            Run a senior-engineering readiness review.
          </h1>
          <p className="text-lg leading-8 text-muted-foreground">
            RepoVitals fetches a bounded set of important files, runs specialized agents, and persists a
            report with scorecards, findings, recommendations, and an architecture diagram.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            "Hard limits protect token spend.",
            "OpenAI calls use structured outputs.",
            "Raw OpenAI keys are never stored.",
            "Reports survive refresh through Postgres.",
          ].map((item) => (
            <div key={item} className="rounded-md border px-4 py-3 text-sm">
              {item}
            </div>
          ))}
        </div>
      </section>
      <AnalyzeRepoForm />
    </main>
  );
}
