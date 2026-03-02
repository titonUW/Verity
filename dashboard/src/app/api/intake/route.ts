import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { WORKFLOWS } from "@/lib/types";

// Valid workflow IDs
const VALID_WORKFLOWS = WORKFLOWS.map(w => w.id);

// SHA-256 hex regex (64 characters, lowercase hex)
const SHA256_REGEX = /^[a-f0-9]{64}$/i;

// Max file size: 100MB
const MAX_FILE_SIZE = 100 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

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

    // Validate required fields exist
    if (!filename || !mime || size === undefined || !sha256 || !workflow) {
      return NextResponse.json(
        { error: "Missing required fields: filename, mime, size, sha256, workflow" },
        { status: 400 }
      );
    }

    // Validate filename is a non-empty string
    if (typeof filename !== "string" || filename.trim().length === 0) {
      return NextResponse.json(
        { error: "filename must be a non-empty string" },
        { status: 400 }
      );
    }

    // Validate size is a positive integer within bounds
    if (typeof size !== "number" || !Number.isInteger(size) || size < 1 || size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `size must be a positive integer between 1 and ${MAX_FILE_SIZE} bytes` },
        { status: 400 }
      );
    }

    // Validate sha256 is a valid 64-character hex string
    if (typeof sha256 !== "string" || !SHA256_REGEX.test(sha256)) {
      return NextResponse.json(
        { error: "sha256 must be a valid 64-character hexadecimal string" },
        { status: 400 }
      );
    }

    // Validate workflow is a known workflow
    if (!VALID_WORKFLOWS.includes(workflow)) {
      return NextResponse.json(
        { error: `workflow must be one of: ${VALID_WORKFLOWS.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate mime is a non-empty string (basic check)
    if (typeof mime !== "string" || mime.trim().length === 0) {
      return NextResponse.json(
        { error: "mime must be a non-empty string" },
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
    console.error("Error during intake:", error instanceof Error ? error.stack : error);

    // Check for specific Prisma errors
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    if (errorMessage.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "A file with this SHA-256 hash may already exist" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: `Failed to process intake: ${errorMessage}` },
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
