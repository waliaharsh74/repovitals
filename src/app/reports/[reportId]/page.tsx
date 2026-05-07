import { notFound, redirect } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { AgentTrace } from "@/components/reports/AgentTrace";
import { ArchitectureDiagram } from "@/components/reports/ArchitectureDiagram";
import { FindingsTable } from "@/components/reports/FindingsTable";
import { Recommendations } from "@/components/reports/Recommendations";
import { ReportHeader } from "@/components/reports/ReportHeader";
import { ScoreCards } from "@/components/reports/ScoreCards";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { getReportById } from "@/lib/db/reports";

export const dynamic = "force-dynamic";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await params;
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/reports/${reportId}`)}`);
  }

  const report = await getReportById(reportId, user.id);

  if (!report) {
    notFound();
  }

  if (report.status === "failed") {
    return (
      <main className="container space-y-8 py-10">
        <ReportHeader report={report} />
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-800">
              <AlertCircle className="size-5" />
              Analysis failed
            </CardTitle>
          </CardHeader>
          <CardContent className="text-red-800">{report.errorMessage}</CardContent>
        </Card>
        {report.agentTrace.length ? <AgentTrace trace={report.agentTrace} /> : null}
      </main>
    );
  }

  if (!report.scorecard || !report.summary || !report.mermaidDiagram) {
    return (
      <main className="container space-y-8 py-10">
        <ReportHeader report={report} />
        <Card>
          <CardHeader>
            <CardTitle>Report is still running</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            Refresh this page in a moment. The MVP runs analysis synchronously, but status is persisted.
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="container space-y-8 py-10">
      <ReportHeader report={report} />
      <ScoreCards scorecard={report.scorecard} />

      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent className="leading-7 text-muted-foreground">{report.summary}</CardContent>
      </Card>

      <ArchitectureDiagram chart={report.mermaidDiagram} />
      <FindingsTable findings={report.findings} />
      <Recommendations recommendations={report.recommendations} />
      <AgentTrace trace={report.agentTrace} />

      {report.selectedFiles.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Selected files</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 text-sm md:grid-cols-2">
              {report.selectedFiles.map((file) => (
                <div key={file.path} className="rounded-md border px-3 py-2">
                  <p className="font-medium">{file.path}</p>
                  <p className="text-muted-foreground">{file.reason}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
