import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateTrustReport, DEFAULT_POLICIES, computeSignals, computeConfidenceScore } from "@/lib/scoring";
import type { ProvenanceEvent, TransparencyProof } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      filename,
      mime,
      size,
      sha256,
      workflow,
      tags = [],
      submitter,
      storePayload = false,
    } = body;

    // Validate required fields
    if (!filename || !mime || !size || !sha256 || !workflow) {
      return NextResponse.json(
        { error: "Missing required fields: filename, mime, size, sha256, workflow" },
        { status: 400 }
      );
    }

    // Create file record
    const file = await prisma.fileRecord.create({
      data: {
        filename,
        mime,
        size,
        sha256,
        workflow,
        tags: JSON.stringify(tags),
        submitter,
        storePayload,
        status: "QUEUED",
      },
    });

    // Log audit entry
    await prisma.auditLog.create({
      data: {
        action: "INTAKE",
        entityType: "FILE",
        entityId: file.id,
        actor: submitter || "system",
        details: JSON.stringify({
          filename,
          workflow,
          sha256: sha256.substring(0, 16) + "...",
        }),
      },
    });

    return NextResponse.json({
      id: file.id,
      status: file.status,
      message: "File queued for verification",
    });
  } catch (error) {
    console.error("Error during intake:", error);
    return NextResponse.json(
      { error: "Failed to process intake" },
      { status: 500 }
    );
  }
}

// GET to list queued/processing files
export async function GET() {
  try {
    const files = await prisma.fileRecord.findMany({
      where: {
        status: { in: ["QUEUED", "PROCESSING"] },
      },
      orderBy: { uploadedAt: "desc" },
      take: 50,
    });

    return NextResponse.json(files);
  } catch (error) {
    console.error("Error fetching queue:", error);
    return NextResponse.json(
      { error: "Failed to fetch queue" },
      { status: 500 }
    );
  }
}
