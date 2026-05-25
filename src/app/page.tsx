import Link from "next/link";
import { ArrowRight, BrainCircuit, Database, GitBranch, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const previewFindings = [
  { severity: "high", text: "OpenAI keys are encrypted for queued jobs and cleared at terminal state." },
  { severity: "medium", text: "Repository analysis runs through Redis/BullMQ with SSE progress updates." },
  { severity: "low", text: "Selected files are stored as metadata and snippets only." },
];

export default function HomePage() {
  return (
    <main>
      <section className="border-b bg-[linear-gradient(180deg,#f8faf9_0%,#ffffff_100%)]">
        <div className="container grid gap-10 py-14 lg:grid-cols-[1fr_440px] lg:items-center">
          <div className="space-y-7">
            <Badge variant="outline">RepoVitals MVP</Badge>
            <div className="max-w-3xl space-y-5">
              <h1 className="text-4xl font-semibold tracking-normal md:text-6xl">
                Paste a GitHub repo. Get a production-readiness review.
              </h1>
              <p className="text-lg leading-8 text-muted-foreground">
                RepoVitals analyzes architecture, security, performance, maintainability, and testability
                with OpenAI-powered agents and strict cost guardrails.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/analyze">
                  Analyze a repository
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a href="#preview">View report preview</a>
              </Button>
            </div>
          </div>

          <div id="preview" className="rounded-md border bg-white shadow-sm">
            <div className="border-b px-5 py-4">
              <p className="text-sm font-medium text-muted-foreground">Example output</p>
              <h2 className="mt-1 text-xl font-semibold">Production readiness: 78</h2>
            </div>
            <div className="space-y-4 p-5">
              <div className="grid grid-cols-3 gap-2">
                {["Architecture 82", "Security 74", "Testing 68"].map((score) => (
                  <div key={score} className="rounded-md bg-muted px-3 py-3 text-sm font-medium">
                    {score}
                  </div>
                ))}
              </div>
              <div className="rounded-md border bg-slate-950 p-4 font-mono text-xs text-teal-100">
                <p>flowchart TD</p>
                <p>GitHubRepo -- selected files --&gt; Agents</p>
                <p>Agents -- findings --&gt; Report</p>
              </div>
              <div className="space-y-2">
                {previewFindings.map((finding) => (
                  <div key={finding.text} className="flex items-start gap-3 rounded-md border px-3 py-2 text-sm">
                    <Badge variant={finding.severity as "high" | "medium" | "low"}>{finding.severity}</Badge>
                    <p>{finding.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container grid gap-4 py-10 md:grid-cols-4">
        {[
          { icon: GitBranch, title: "GitHub ingestion", text: "Fetches public repo metadata, tree, and bounded file contents." },
          { icon: BrainCircuit, title: "Composable agents", text: "Specialized reviewers produce structured findings and recommendations." },
          {
            icon: ShieldCheck,
            title: "Key-safe MVP",
            text: "OpenAI keys are encrypted for the queued run and cleared when the job finishes.",
          },
          { icon: Database, title: "Shareable reports", text: "Postgres stores reports, findings, trace, and selected file metadata." },
        ].map((item) => (
          <Card key={item.title}>
            <CardHeader>
              <item.icon className="size-5 text-primary" />
              <CardTitle className="text-base">{item.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-6 text-muted-foreground">{item.text}</CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
