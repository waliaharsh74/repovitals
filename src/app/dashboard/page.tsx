import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Clock, Plus, SearchCode } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { getReportsForUser } from "@/lib/db/reports";

export const dynamic = "force-dynamic";

function statusVariant(status: string): "critical" | "low" | "default" {
  if (status === "completed") {
    return "low";
  }

  if (status === "failed") {
    return "critical";
  }

  return "default";
}

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?callbackUrl=/dashboard");
  }

  const reports = await getReportsForUser(user.id);
  const completedCount = reports.filter((report) => report.status === "completed").length;
  const findingCount = reports.reduce((sum, report) => sum + report.findingCount, 0);

  return (
    <main className="container space-y-8 py-10">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-primary">Saved reports</p>
          <h1 className="text-3xl font-semibold md:text-4xl">Dashboard</h1>
          <p className="max-w-2xl text-muted-foreground">
            Reports created while signed in are saved to this account and remain available after refresh.
          </p>
        </div>
        <Button asChild>
          <Link href="/analyze">
            <Plus className="size-4" />
            New analysis
          </Link>
        </Button>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Total reports</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{reports.length}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Completed</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{completedCount}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Findings</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{findingCount}</CardContent>
        </Card>
      </section>

      {reports.length ? (
        <section className="space-y-3">
          {reports.map((report) => (
            <Card key={report.id}>
              <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={statusVariant(report.status)}>{report.status}</Badge>
                    <Badge variant="outline">{report.provider}</Badge>
                    {report.overallScore !== null ? (
                      <Badge variant="outline">Overall {report.overallScore}</Badge>
                    ) : null}
                  </div>
                  <div>
                    <h2 className="truncate text-lg font-semibold">
                      {report.repository.owner}/{report.repository.name}
                    </h2>
                    <p className="mt-1 line-clamp-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                      {report.status === "failed"
                        ? report.errorMessage
                        : report.summary ?? "Analysis is still running."}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <SearchCode className="size-4" />
                      {report.findingCount} findings
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-4" />
                      {new Intl.DateTimeFormat("en", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(report.createdAt)}
                    </span>
                  </div>
                </div>
                <Button asChild variant="outline">
                  <Link href={`/reports/${report.id}`}>
                    Open report
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-start gap-4 p-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">No saved reports yet</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Start an analysis to save the report to this dashboard.
              </p>
            </div>
            <Button asChild>
              <Link href="/analyze">
                <Plus className="size-4" />
                Analyze a repository
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
