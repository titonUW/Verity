import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const workflow = searchParams.get("workflow");
    const decision = searchParams.get("decision");
    const status = searchParams.get("status");
    const minScore = searchParams.get("minScore");
    const maxScore = searchParams.get("maxScore");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const where: Record<string, unknown> = {};

    if (workflow) where.workflow = workflow;
    if (status) where.status = status;

    const files = await prisma.fileRecord.findMany({
      where,
      include: {
        trustReports: {
          take: 1,
          orderBy: { createdAt: "desc" },
        },
        policyDecisions: {
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { uploadedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    const total = await prisma.fileRecord.count({ where });

    // Transform files with trust report data
    const transformedFiles = files.map((file) => {
      const report = file.trustReports[0];
      const policyDecision = file.policyDecisions[0];

      let trustData = null;
      if (report) {
        try {
          trustData = JSON.parse(report.json);
        } catch {
          // Skip malformed reports
        }
      }

      return {
        id: file.id,
        filename: file.filename,
        mime: file.mime,
        size: file.size,
        sha256: file.sha256,
        uploadedAt: file.uploadedAt,
        workflow: file.workflow,
        tags: JSON.parse(file.tags),
        status: file.status,
        submitter: file.submitter,
        humanOrigin: trustData?.human_origin_proof?.value || "UNAVAILABLE",
        score: trustData?.reality_confidence?.score || null,
        grade: trustData?.reality_confidence?.grade || null,
        decision: policyDecision?.decision || trustData?.context_decision?.decision || null,
        integrityOk: trustData?.integrity
          ? Object.values(trustData.integrity).every(v => v === true)
          : null,
      };
    });

    // Filter by decision and score if needed (post-query filter for simplicity)
    let filtered = transformedFiles;
    if (decision) {
      filtered = filtered.filter(f => f.decision === decision);
    }
    if (minScore) {
      filtered = filtered.filter(f => f.score !== null && f.score >= parseInt(minScore));
    }
    if (maxScore) {
      filtered = filtered.filter(f => f.score !== null && f.score <= parseInt(maxScore));
    }

    return NextResponse.json({
      files: filtered,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching files:", error);
    return NextResponse.json(
      { error: "Failed to fetch files" },
      { status: 500 }
    );
  }
}
