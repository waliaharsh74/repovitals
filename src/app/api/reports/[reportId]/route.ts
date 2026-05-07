import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getReportById } from "@/lib/db/reports";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ reportId: string }> },
) {
  const { reportId } = await context.params;
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Sign in to view saved reports.",
        },
      },
      { status: 401 },
    );
  }

  const report = await getReportById(reportId, user.id);

  if (!report) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Report not found." } },
      { status: 404 },
    );
  }

  return NextResponse.json({ report });
}
