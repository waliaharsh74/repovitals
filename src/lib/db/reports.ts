import type {
  AgentTraceStep,
  AnalysisReport,
  Scorecard,
  SelectedFileMetadata,
} from "@/lib/agents/types";
import { prisma } from "@/lib/db/prisma";
import { findingToCreateManyInput } from "@/lib/db/findings";
import { AnalysisFailedError } from "@/lib/utils/errors";

export async function createReport(input: {
  repositoryId: string;
  userId: string;
}) {
  return prisma.analysisReport.create({
    data: {
      repositoryId: input.repositoryId,
      userId: input.userId,
      status: "pending",
    },
  });
}

export async function updateReportRepository(input: {
  reportId: string;
  repositoryId: string;
}) {
  return prisma.analysisReport.update({
    where: { id: input.reportId },
    data: { repositoryId: input.repositoryId },
  });
}

export async function markReportRunning(reportId: string) {
  const transition = await prisma.analysisReport.updateMany({
    where: { id: reportId, status: "pending" },
    data: { status: "running", errorMessage: null },
  });

  const report = await prisma.analysisReport.findUnique({ where: { id: reportId } });
  if (!report) {
    throw new AnalysisFailedError("Report record was not found.");
  }

  if (transition.count === 0 && report.status !== "running" && report.status !== "completed") {
    throw new AnalysisFailedError(`Report ${reportId} cannot transition from ${report.status} to running.`);
  }

  return report;
}

export async function completeReport(input: {
  reportId: string;
  report: AnalysisReport;
  selectedFiles: SelectedFileMetadata[];
}) {
  return prisma.$transaction(async (tx) => {
    const transition = await tx.analysisReport.updateMany({
      where: { id: input.reportId, status: { in: ["pending", "running"] } },
      data: {
        status: "completed",
        summary: input.report.summary,
        scorecardJson: input.report.scorecard as never,
        mermaidDiagram: input.report.architectureDiagramMermaid,
        recommendationsJson: input.report.recommendations as never,
        agentTraceJson: input.report.agentTrace as never,
        selectedFilesJson: input.selectedFiles as never,
        errorMessage: null,
      },
    });

    const current = await tx.analysisReport.findUnique({ where: { id: input.reportId } });
    if (!current) {
      throw new AnalysisFailedError("Report record was not found.");
    }

    if (transition.count === 0) {
      if (current.status === "completed") {
        return current;
      }
      throw new AnalysisFailedError(`Report ${input.reportId} cannot transition from ${current.status} to completed.`);
    }

    await tx.finding.deleteMany({
      where: { reportId: input.reportId },
    });

    if (input.report.findings.length > 0) {
      await tx.finding.createMany({
        data: input.report.findings.map((finding) => ({
          ...findingToCreateManyInput(finding),
          reportId: input.reportId,
        })),
      });
    }

    return tx.analysisReport.findUniqueOrThrow({ where: { id: input.reportId } });
  });
}

export async function failReport(reportId: string, errorMessage: string) {
  const transition = await prisma.analysisReport.updateMany({
    where: { id: reportId, status: { in: ["pending", "running"] } },
    data: {
      status: "failed",
      errorMessage,
    },
  });

  const report = await prisma.analysisReport.findUnique({ where: { id: reportId } });
  if (!report) {
    throw new AnalysisFailedError("Report record was not found.");
  }

  if (transition.count === 0 && report.status !== "failed" && report.status !== "completed") {
    throw new AnalysisFailedError(`Report ${reportId} cannot transition from ${report.status} to failed.`);
  }

  return report;
}

export type ReportView = {
  id: string;
  userId: string | null;
  status: string;
  summary: string | null;
  scorecard: Scorecard | null;
  mermaidDiagram: string | null;
  recommendations: string[];
  agentTrace: AgentTraceStep[];
  selectedFiles: SelectedFileMetadata[];
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  repository: {
    owner: string;
    name: string;
    url: string;
    defaultBranch: string | null;
  };
  findings: {
    id: string;
    title: string;
    category: string;
    severity: string;
    confidence: number;
    filePath: string | null;
    lineHint: number | null;
    explanation: string;
    recommendation: string;
    suggestedPatch: string | null;
  }[];
};

type FindingRecord = ReportView["findings"][number];

export async function getReportById(reportId: string, userId: string): Promise<ReportView | null> {
  const report = await prisma.analysisReport.findFirst({
    where: {
      id: reportId,
      userId,
    },
    include: {
      repository: true,
      findings: {
        orderBy: [{ severity: "asc" }, { confidence: "desc" }],
      },
    },
  });

  if (!report) {
    return null;
  }

  return {
    id: report.id,
    userId: report.userId,
    status: report.status,
    summary: report.summary,
    scorecard: report.scorecardJson as Scorecard | null,
    mermaidDiagram: report.mermaidDiagram,
    recommendations: (report.recommendationsJson as string[] | null) ?? [],
    agentTrace: (report.agentTraceJson as AgentTraceStep[] | null) ?? [],
    selectedFiles: (report.selectedFilesJson as SelectedFileMetadata[] | null) ?? [],
    errorMessage: report.errorMessage,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    repository: {
      owner: report.repository.owner,
      name: report.repository.name,
      url: report.repository.url,
      defaultBranch: report.repository.defaultBranch,
    },
    findings: (report.findings as FindingRecord[]).map((finding) => ({
      id: finding.id,
      title: finding.title,
      category: finding.category,
      severity: finding.severity,
      confidence: finding.confidence,
      filePath: finding.filePath,
      lineHint: finding.lineHint,
      explanation: finding.explanation,
      recommendation: finding.recommendation,
      suggestedPatch: finding.suggestedPatch,
    })),
  };
}

export type ReportSummary = {
  id: string;
  status: string;
  summary: string | null;
  overallScore: number | null;
  findingCount: number;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  repository: {
    owner: string;
    name: string;
    url: string;
  };
};

export async function getReportsForUser(userId: string): Promise<ReportSummary[]> {
  const reports = await prisma.analysisReport.findMany({
    where: { userId },
    include: {
      repository: true,
      _count: {
        select: { findings: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return reports.map((report) => ({
    id: report.id,
    status: report.status,
    summary: report.summary,
    overallScore:
      typeof (report.scorecardJson as Scorecard | null)?.overall === "number"
        ? (report.scorecardJson as Scorecard).overall
        : null,
    findingCount: report._count.findings,
    errorMessage: report.errorMessage,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    repository: {
      owner: report.repository.owner,
      name: report.repository.name,
      url: report.repository.url,
    },
  }));
}
