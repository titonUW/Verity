import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateTrustReport, DEFAULT_POLICIES } from "@/lib/scoring";
import type { ProvenanceEvent, TransparencyProof } from "@/lib/types";

// Helper to generate deterministic provenance events based on file hash
function generateProvenanceEvents(sha256: string, workflow: string): ProvenanceEvent[] {
  const seed = parseInt(sha256.substring(0, 8), 16);
  const hasAiEdit = (seed % 7) === 0; // ~14% chance of AI edit
  const eventCount = 1 + (seed % 3); // 1-3 events

  const events: ProvenanceEvent[] = [];
  let prevHash: string | null = null;

  // Always start with CAPTURE
  const captureHash = sha256.substring(0, 16) + "0000";
  events.push({
    idx: 0,
    eventType: "CAPTURE",
    eventTime: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    actorKeyId: "device_" + sha256.substring(0, 8),
    eventHash: captureHash,
    prevEventHash: null,
    signature: "sig_" + sha256.substring(8, 24),
    valid: true,
    metadata: { device: "trusted_camera_01" },
  });
  prevHash = captureHash;

  // Maybe add AI_EDIT
  if (hasAiEdit) {
    const aiHash = sha256.substring(16, 32) + "0001";
    events.push({
      idx: 1,
      eventType: "AI_EDIT",
      eventTime: new Date(Date.now() - 43200000).toISOString(), // 12 hours ago
      actorKeyId: "ai_service_" + sha256.substring(0, 4),
      eventHash: aiHash,
      prevEventHash: prevHash,
      signature: "sig_" + sha256.substring(24, 40),
      valid: true,
      metadata: { model: "enhancement_v1", operation: "auto_adjust" },
    });
    prevHash = aiHash;
  }

  // Add SIGN event for high-security workflows
  if (["wire-transfer", "vendor-bank-change"].includes(workflow)) {
    const signHash = sha256.substring(32, 48) + "0002";
    events.push({
      idx: events.length,
      eventType: "SIGN",
      eventTime: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      actorKeyId: "user_" + sha256.substring(4, 12),
      eventHash: signHash,
      prevEventHash: prevHash,
      signature: "sig_" + sha256.substring(40, 56),
      valid: true,
      metadata: { purpose: "authorization" },
    });
  }

  return events;
}

// Helper to generate transparency proof
function generateTransparencyProof(sha256: string): TransparencyProof | null {
  const seed = parseInt(sha256.substring(0, 8), 16);
  const hasProof = (seed % 3) !== 0; // ~67% chance of having proof

  if (!hasProof) return null;

  return {
    leafIndex: seed % 10000,
    leafHash: sha256.substring(0, 32) + sha256.substring(0, 32),
    rootHash: sha256.substring(32, 64) + sha256.substring(32, 64),
    treeSize: 10000 + (seed % 50000),
    checkpointSig: "checkpoint_sig_" + sha256.substring(0, 32),
    proof: [
      sha256.substring(8, 40) + sha256.substring(8, 40),
      sha256.substring(16, 48) + sha256.substring(16, 48),
    ],
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await params;

    // Get file record
    const file = await prisma.fileRecord.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    // Update status to processing
    await prisma.fileRecord.update({
      where: { id: fileId },
      data: { status: "PROCESSING" },
    });

    // Create verification run
    const run = await prisma.verificationRun.create({
      data: {
        fileId,
        verifierVersion: "1.0.0",
        overallStatus: "PENDING",
      },
    });

    // Generate provenance events (deterministic based on sha256)
    const provenanceEvents = generateProvenanceEvents(file.sha256, file.workflow);

    // Store provenance events
    for (const event of provenanceEvents) {
      await prisma.provenanceEvent.upsert({
        where: {
          fileId_idx: {
            fileId,
            idx: event.idx,
          },
        },
        update: {},
        create: {
          fileId,
          idx: event.idx,
          eventType: event.eventType,
          eventTime: new Date(event.eventTime),
          actorKeyId: event.actorKeyId,
          eventHash: event.eventHash,
          prevEventHash: event.prevEventHash,
          signature: event.signature,
          valid: event.valid,
          metadata: JSON.stringify(event.metadata),
        },
      });
    }

    // Generate transparency proof
    const transparencyProof = generateTransparencyProof(file.sha256);

    if (transparencyProof) {
      await prisma.transparencyProof.create({
        data: {
          fileId,
          leafIndex: transparencyProof.leafIndex,
          leafHash: transparencyProof.leafHash,
          rootHash: transparencyProof.rootHash,
          treeSize: transparencyProof.treeSize,
          checkpointSig: transparencyProof.checkpointSig,
          proofJson: JSON.stringify(transparencyProof.proof),
        },
      });
    }

    // Get policy for workflow
    const policy = DEFAULT_POLICIES[file.workflow] || DEFAULT_POLICIES["content-publishing"];

    // Build scoring context
    const scoringContext = {
      sha256: file.sha256,
      storedSha256: file.sha256, // In demo, always matches
      mime: file.mime,
      size: file.size,
      uploadedAt: file.uploadedAt,
      provenanceEvents,
      hasTransparencyProof: !!transparencyProof,
      transparencyProofValid: !!transparencyProof,
      signatures: provenanceEvents
        .filter((e) => e.eventType === "SIGN" || e.eventType === "CAPTURE")
        .map((e) => ({ keyId: e.actorKeyId, valid: e.valid })),
      hasAiEdit: provenanceEvents.some((e) => e.eventType === "AI_EDIT"),
    };

    // Generate trust report
    const trustReport = generateTrustReport(
      fileId,
      run.id,
      scoringContext,
      provenanceEvents,
      transparencyProof,
      file.workflow,
      policy
    );

    // Store trust report
    await prisma.trustReport.create({
      data: {
        fileId,
        json: JSON.stringify(trustReport),
      },
    });

    // Store signal results
    for (const signal of trustReport.reality_confidence.reasons) {
      await prisma.signalResult.create({
        data: {
          fileId,
          runId: run.id,
          name: signal.name,
          delta: signal.delta,
          severity: signal.severity,
          explanation: signal.explanation,
          evidenceJson: JSON.stringify(signal.evidence),
        },
      });
    }

    // Get or create workflow and policy version
    let workflow = await prisma.policyWorkflow.findUnique({
      where: { name: file.workflow },
    });

    if (!workflow) {
      workflow = await prisma.policyWorkflow.create({
        data: {
          name: file.workflow,
          description: `${file.workflow} workflow`,
        },
      });
    }

    let policyVersion = await prisma.policyVersion.findFirst({
      where: {
        workflowId: workflow.id,
        version: policy.version,
      },
    });

    if (!policyVersion) {
      policyVersion = await prisma.policyVersion.create({
        data: {
          workflowId: workflow.id,
          version: policy.version,
          policyJson: JSON.stringify(policy),
          isActive: true,
        },
      });
    }

    // Store policy decision
    await prisma.policyDecision.create({
      data: {
        fileId,
        workflowId: workflow.id,
        policyVersionId: policyVersion.id,
        decision: trustReport.context_decision.decision,
        rationale: trustReport.context_decision.rationale,
        matchedRules: JSON.stringify(trustReport.context_decision.matched_rules),
      },
    });

    // Update verification run and file status
    const overallStatus = trustReport.integrity.payload_hash_ok ? "PASSED" : "FAILED";
    await prisma.verificationRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        overallStatus,
      },
    });

    await prisma.fileRecord.update({
      where: { id: fileId },
      data: { status: "VERIFIED" },
    });

    // Log audit entry
    await prisma.auditLog.create({
      data: {
        action: "VERIFY",
        entityType: "FILE",
        entityId: fileId,
        actor: "system",
        details: JSON.stringify({
          runId: run.id,
          score: trustReport.reality_confidence.score,
          decision: trustReport.context_decision.decision,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      runId: run.id,
      trustReport,
    });
  } catch (error) {
    console.error("Error during verification:", error);
    return NextResponse.json(
      { error: "Failed to verify file" },
      { status: 500 }
    );
  }
}
