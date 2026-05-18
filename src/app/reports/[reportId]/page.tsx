import { notFound, redirect } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { AgentTrace } from "@/components/reports/AgentTrace";
import { ArchitectureDiagram } from "@/components/reports/ArchitectureDiagram";
import { FindingsTable } from "@/components/reports/FindingsTable";
import { Recommendations } from "@/components/reports/Recommendations";
import { ReportAnalysisWorkflow } from "@/components/reports/ReportAnalysisWorkflow";
import { ReportAccordionSection } from "@/components/reports/ReportAccordionSection";
import { ReportHeader } from "@/components/reports/ReportHeader";
import { ScoreCards } from "@/components/reports/ScoreCards";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { getAnalysisJobSnapshotForReport } from "@/lib/db/analysisJobs";
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
        {report.agentTrace.length ? (
          <ReportAccordionSection
            title="Agent trace"
            badge={`${report.agentTrace.length} steps`}
            defaultOpen={false}
          >
            <AgentTrace trace={report.agentTrace} />
          </ReportAccordionSection>
        ) : null}
      </main>
    );
  }

  if (!report.scorecard || !report.summary || !report.mermaidDiagram) {
    const analysisJob = await getAnalysisJobSnapshotForReport({
      reportId,
      userId: user.id,
    });

    return (
      <main className="container space-y-8 py-10">
        <ReportHeader report={report} />
        <ReportAnalysisWorkflow initialSnapshot={analysisJob} />
      </main>
    );
  }

  return (
    <main className="container space-y-8 py-10">
      <ReportHeader report={report} />
      <ScoreCards scorecard={report.scorecard} />

      <ReportAccordionSection title="Summary">
        <p className="leading-7 text-muted-foreground">{report.summary}</p>
      </ReportAccordionSection>

      <ReportAccordionSection
        title="Architecture diagram"
        description="Rendered from the analyzed repository structure."
      >
        <ArchitectureDiagram chart={report.mermaidDiagram} />
      </ReportAccordionSection>

      <ReportAccordionSection
        title="Top findings"
        description="Severity-ranked issues grouped by review category."
        badge={`${report.findings.length} ${report.findings.length === 1 ? "finding" : "findings"}`}
      >
        <FindingsTable findings={report.findings} />
      </ReportAccordionSection>

      <ReportAccordionSection
        title="Recommendations"
        badge={`${report.recommendations.length} items`}
        defaultOpen={false}
      >
        <Recommendations recommendations={report.recommendations} />
      </ReportAccordionSection>

      <ReportAccordionSection
        title="Agent trace"
        badge={`${report.agentTrace.length} steps`}
        defaultOpen={false}
      >
        <AgentTrace trace={report.agentTrace} />
      </ReportAccordionSection>

      {report.selectedFiles.length ? (
        <ReportAccordionSection
          title="Selected files"
          badge={`${report.selectedFiles.length} files`}
          defaultOpen={false}
        >
          <div className="grid gap-2 text-sm md:grid-cols-2">
            {report.selectedFiles.map((file) => (
              <div key={file.path} className="rounded-md border px-3 py-2">
                <p className="font-medium">{file.path}</p>
                <p className="text-muted-foreground">{file.reason}</p>
              </div>
            ))}
          </div>
        </ReportAccordionSection>
      ) : null}
    </main>
  );
}
