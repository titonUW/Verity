import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const file = await prisma.fileRecord.findUnique({
      where: { id },
      include: {
        trustReports: {
          take: 1,
          orderBy: { createdAt: "desc" },
        },
        provenanceEvents: {
          orderBy: { idx: "asc" },
        },
        signalResults: {
          orderBy: { name: "asc" },
        },
        policyDecisions: {
          take: 1,
          orderBy: { createdAt: "desc" },
          include: {
            policyVersion: {
              include: {
                workflow: true,
              },
            },
          },
        },
        transparencyProofs: {
          take: 1,
          orderBy: { createdAt: "desc" },
        },
        verificationRuns: {
          take: 1,
          orderBy: { startedAt: "desc" },
        },
      },
    });

    if (!file) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    // Parse trust report
    let trustReport = null;
    if (file.trustReports[0]) {
      try {
        trustReport = JSON.parse(file.trustReports[0].json);
      } catch {
        // Skip malformed reports
      }
    }

    // Parse transparency proof
    let transparencyProof = null;
    if (file.transparencyProofs[0]) {
      const tp = file.transparencyProofs[0];
      try {
        transparencyProof = {
          leafIndex: tp.leafIndex,
          leafHash: tp.leafHash,
          rootHash: tp.rootHash,
          treeSize: tp.treeSize,
          checkpointSig: tp.checkpointSig,
          proof: JSON.parse(tp.proofJson),
        };
      } catch {
        // Skip malformed proof
      }
    }

    // Transform provenance events
    const provenanceEvents = file.provenanceEvents.map((e) => ({
      idx: e.idx,
      eventType: e.eventType,
      eventTime: e.eventTime.toISOString(),
      actorKeyId: e.actorKeyId,
      eventHash: e.eventHash,
      prevEventHash: e.prevEventHash,
      signature: e.signature,
      valid: e.valid,
      metadata: JSON.parse(e.metadata),
    }));

    // Transform signal results
    const signals = file.signalResults.map((s) => ({
      name: s.name,
      delta: s.delta,
      severity: s.severity,
      explanation: s.explanation,
      evidence: JSON.parse(s.evidenceJson),
    }));

    const response = {
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
      trustReport,
      provenanceEvents,
      signals,
      transparencyProof,
      policyDecision: file.policyDecisions[0] ? {
        decision: file.policyDecisions[0].decision,
        rationale: file.policyDecisions[0].rationale,
        matchedRules: JSON.parse(file.policyDecisions[0].matchedRules),
        workflowName: file.policyDecisions[0].policyVersion?.workflow?.name,
        policyVersion: file.policyDecisions[0].policyVersion?.version,
      } : null,
      verificationRun: file.verificationRuns[0] ? {
        id: file.verificationRuns[0].id,
        startedAt: file.verificationRuns[0].startedAt,
        finishedAt: file.verificationRuns[0].finishedAt,
        status: file.verificationRuns[0].overallStatus,
        version: file.verificationRuns[0].verifierVersion,
      } : null,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching file:", error);
    return NextResponse.json(
      { error: "Failed to fetch file" },
      { status: 500 }
    );
  }
}
