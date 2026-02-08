import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const [
      totalFiles,
      verifiedFiles,
      trustReports,
    ] = await Promise.all([
      prisma.fileRecord.count(),
      prisma.fileRecord.count({ where: { status: "VERIFIED" } }),
      prisma.trustReport.findMany({
        select: { json: true },
      }),
    ]);

    // Parse trust reports to get stats
    let warnings = 0;
    let blocks = 0;
    let humanOriginYes = 0;
    let totalConfidence = 0;
    let reportCount = 0;

    for (const report of trustReports) {
      try {
        const data = JSON.parse(report.json);
        if (data.context_decision?.decision === "WARN") warnings++;
        if (data.context_decision?.decision === "BLOCK") blocks++;
        if (data.human_origin_proof?.value === "YES") humanOriginYes++;
        if (data.reality_confidence?.score !== undefined) {
          totalConfidence += data.reality_confidence.score;
          reportCount++;
        }
      } catch {
        // Skip malformed reports
      }
    }

    const stats = {
      totalFiles,
      verified: verifiedFiles,
      warnings,
      blocks,
      avgConfidence: reportCount > 0 ? Math.round(totalConfidence / reportCount) : 0,
      humanOriginYes,
      humanOriginTotal: reportCount,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
