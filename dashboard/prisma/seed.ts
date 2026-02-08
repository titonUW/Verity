import { PrismaClient } from "@prisma/client";
import { DEFAULT_POLICIES } from "../src/lib/scoring";

const prisma = new PrismaClient();

// Helper to generate deterministic hash from seed
function generateHash(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, "0");
  return (hex + hex + hex + hex + hex + hex + hex + hex).substring(0, 64);
}

// Sample files with variety of scores and decisions
const SAMPLE_FILES = [
  { name: "vendor_bank_update_acme.pdf", workflow: "vendor-bank-change", mime: "application/pdf", size: 245000 },
  { name: "wire_transfer_authorization.pdf", workflow: "wire-transfer", mime: "application/pdf", size: 128000 },
  { name: "offer_letter_john_doe.docx", workflow: "hr-offer-letter", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 89000 },
  { name: "claim_evidence_photo_001.jpg", workflow: "insurance-claim", mime: "image/jpeg", size: 2450000 },
  { name: "press_release_q4.txt", workflow: "content-publishing", mime: "text/plain", size: 12000 },
  { name: "vendor_invoice_12345.pdf", workflow: "vendor-bank-change", mime: "application/pdf", size: 345000 },
  { name: "emergency_wire_request.pdf", workflow: "wire-transfer", mime: "application/pdf", size: 156000 },
  { name: "promotion_letter_jane.docx", workflow: "hr-offer-letter", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 78000 },
  { name: "accident_photo_evidence.png", workflow: "insurance-claim", mime: "image/png", size: 3200000 },
  { name: "blog_post_draft.md", workflow: "content-publishing", mime: "text/markdown", size: 8500 },
  { name: "supplier_contract_amendment.pdf", workflow: "vendor-bank-change", mime: "application/pdf", size: 567000 },
  { name: "international_transfer.pdf", workflow: "wire-transfer", mime: "application/pdf", size: 198000 },
  { name: "termination_letter.docx", workflow: "hr-offer-letter", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 45000 },
  { name: "medical_records_scan.pdf", workflow: "insurance-claim", mime: "application/pdf", size: 1890000 },
  { name: "social_media_post.txt", workflow: "content-publishing", mime: "text/plain", size: 2300 },
  { name: "vendor_w9_form.pdf", workflow: "vendor-bank-change", mime: "application/pdf", size: 234000 },
  { name: "payroll_wire_batch.csv", workflow: "wire-transfer", mime: "text/csv", size: 45000 },
  { name: "contractor_agreement.pdf", workflow: "hr-offer-letter", mime: "application/pdf", size: 156000 },
  { name: "property_damage_video.mp4", workflow: "insurance-claim", mime: "video/mp4", size: 15000000 },
  { name: "newsletter_draft.html", workflow: "content-publishing", mime: "text/html", size: 18000 },
];

async function seed() {
  console.log("🌱 Seeding database...");

  // Create workflows and policy versions
  console.log("Creating workflows and policies...");
  for (const [workflowName, policy] of Object.entries(DEFAULT_POLICIES)) {
    const workflow = await prisma.policyWorkflow.upsert({
      where: { name: workflowName },
      update: {},
      create: {
        name: workflowName,
        description: `${workflowName.replace(/-/g, " ")} workflow`,
      },
    });

    await prisma.policyVersion.upsert({
      where: {
        workflowId_version: {
          workflowId: workflow.id,
          version: policy.version,
        },
      },
      update: {},
      create: {
        workflowId: workflow.id,
        version: policy.version,
        policyJson: JSON.stringify(policy),
        isActive: true,
        createdBy: "system",
      },
    });
  }

  // Create trusted keys
  console.log("Creating trusted keys...");
  const keys = [
    { keyId: "device_capture_01", name: "Primary Capture Device", publicKey: "pk_" + generateHash("device1").substring(0, 32) },
    { keyId: "device_capture_02", name: "Secondary Capture Device", publicKey: "pk_" + generateHash("device2").substring(0, 32) },
    { keyId: "signing_authority", name: "Document Signing Authority", publicKey: "pk_" + generateHash("signer").substring(0, 32) },
  ];

  for (const key of keys) {
    await prisma.trustedKey.upsert({
      where: { keyId: key.keyId },
      update: {},
      create: key,
    });
  }

  // Create sample files with verification data
  console.log("Creating sample files...");
  let blockedCount = 0;
  let warnCount = 0;

  for (let i = 0; i < SAMPLE_FILES.length; i++) {
    const sample = SAMPLE_FILES[i];
    const sha256 = generateHash(`${sample.name}_${i}`);
    const uploadDate = new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000);

    // Create file record
    const file = await prisma.fileRecord.create({
      data: {
        filename: sample.name,
        mime: sample.mime,
        size: sample.size,
        sha256,
        workflow: sample.workflow,
        uploadedAt: uploadDate,
        status: "VERIFIED",
        submitter: ["admin", "analyst", "user"][i % 3],
        tags: JSON.stringify(["sample", sample.workflow]),
      },
    });

    // Create verification run
    const run = await prisma.verificationRun.create({
      data: {
        fileId: file.id,
        startedAt: uploadDate,
        finishedAt: new Date(uploadDate.getTime() + 2000),
        verifierVersion: "1.0.0",
        overallStatus: "PASSED",
      },
    });

    // Determine score based on index to ensure variety
    // Files 3, 7, 15 will be BLOCKED (low scores)
    // Files 1, 5, 9, 13, 17 will be WARN
    const isBlocked = [3, 7, 15].includes(i) && blockedCount < 3;
    const isWarn = [1, 5, 9, 13, 17].includes(i) && warnCount < 5;

    if (isBlocked) blockedCount++;
    if (isWarn) warnCount++;

    const baseScore = isBlocked ? 35 : isWarn ? 65 : 85;
    const scoreVariance = Math.floor(Math.random() * 10) - 5;
    const score = Math.max(0, Math.min(100, baseScore + scoreVariance));

    const grade = score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";
    const hasAiEdit = isBlocked || (i % 7 === 0);
    const humanOrigin = hasAiEdit ? "NO" : score >= 60 ? "YES" : "UNAVAILABLE";

    // Get policy for decision
    const policy = DEFAULT_POLICIES[sample.workflow] || DEFAULT_POLICIES["content-publishing"];
    let decision: string;
    let rationale: string;

    if (isBlocked) {
      decision = "BLOCK";
      rationale = "Verification requirements not met - score too low";
    } else if (isWarn) {
      decision = "WARN";
      rationale = "Additional verification recommended";
    } else if (sample.workflow === "wire-transfer" && score < 95) {
      decision = "REQUIRE_EXTRA_VERIFICATION";
      rationale = "High-value transfer requires additional approval";
    } else {
      decision = "ALLOW";
      rationale = "All verification requirements satisfied";
    }

    // Create trust report
    const trustReport = {
      human_origin_proof: {
        value: humanOrigin,
        reason: humanOrigin === "YES" ? "Verified human capture with no AI modifications" :
                humanOrigin === "NO" ? "AI modification detected" : "Insufficient data",
        evidence: { capture_verified: !hasAiEdit, ai_edit_detected: hasAiEdit },
      },
      reality_confidence: {
        score,
        grade,
        reasons: [],
        limitations: score < 70 ? "Some verification checks did not pass" : "No significant limitations",
      },
      context_decision: {
        workflow: sample.workflow,
        decision,
        policy_version: policy.version,
        rationale,
        matched_rules: [decision.toLowerCase() + "_rule"],
      },
      integrity: {
        payload_hash_ok: true,
        manifest_signature_ok: !isBlocked,
        event_chain_ok: !isBlocked,
        transparency_log_ok: Math.random() > 0.3,
      },
      timestamps: {
        ingested_at: uploadDate.toISOString(),
        verified_at: new Date(uploadDate.getTime() + 2000).toISOString(),
      },
      ids: {
        file_id: file.id,
        run_id: run.id,
      },
    };

    await prisma.trustReport.create({
      data: {
        fileId: file.id,
        json: JSON.stringify(trustReport),
      },
    });

    // Create provenance events
    const events: Array<{
      idx: number;
      eventType: string;
      eventTime: Date;
      actorKeyId: string;
      eventHash: string;
      prevEventHash: string | null;
      signature: string;
      valid: boolean;
      metadata: string;
    }> = [
      {
        idx: 0,
        eventType: "CAPTURE",
        eventTime: new Date(uploadDate.getTime() - 3600000),
        actorKeyId: keys[i % 2].keyId,
        eventHash: generateHash(`${file.id}_event_0`),
        prevEventHash: null,
        signature: "sig_" + generateHash(`${file.id}_sig_0`).substring(0, 32),
        valid: true,
        metadata: JSON.stringify({ device: keys[i % 2].name }),
      },
    ];

    if (hasAiEdit) {
      events.push({
        idx: 1,
        eventType: "AI_EDIT",
        eventTime: new Date(uploadDate.getTime() - 1800000),
        actorKeyId: "ai_service_01",
        eventHash: generateHash(`${file.id}_event_1`),
        prevEventHash: events[0].eventHash,
        signature: "sig_" + generateHash(`${file.id}_sig_1`).substring(0, 32),
        valid: true,
        metadata: JSON.stringify({ model: "enhancement_v1" }),
      });
    }

    for (const event of events) {
      await prisma.provenanceEvent.create({
        data: {
          fileId: file.id,
          ...event,
        },
      });
    }

    // Create signal results
    const signals = [
      { name: "payload_hash_match", delta: 20, severity: "CRITICAL", explanation: "Payload hash verified" },
      { name: "mime_type_recognized", delta: 5, severity: "LOW", explanation: `Recognized MIME type: ${sample.mime}` },
      { name: "timestamp_sanity", delta: isBlocked ? -15 : 10, severity: "MEDIUM", explanation: isBlocked ? "Timestamp anomaly" : "Timestamps valid" },
      { name: "capture_event_present", delta: 15, severity: "HIGH", explanation: "CAPTURE event present" },
      { name: "event_chain_continuity", delta: isBlocked ? -20 : 15, severity: "HIGH", explanation: isBlocked ? "Event chain broken" : "Event chain verified" },
      { name: "signature_validity", delta: isBlocked ? -25 : 15, severity: "HIGH", explanation: isBlocked ? "Signature invalid" : "Signatures verified" },
      { name: "transparency_log_proof", delta: trustReport.integrity.transparency_log_ok ? 15 : 0, severity: "MEDIUM", explanation: trustReport.integrity.transparency_log_ok ? "Log proof valid" : "No log proof" },
      { name: "ai_edit_detection", delta: hasAiEdit ? -30 : 5, severity: "CRITICAL", explanation: hasAiEdit ? "AI edit detected" : "No AI modifications" },
    ];

    for (const signal of signals) {
      await prisma.signalResult.create({
        data: {
          fileId: file.id,
          runId: run.id,
          name: signal.name,
          delta: signal.delta,
          severity: signal.severity,
          explanation: signal.explanation,
          evidenceJson: JSON.stringify({}),
        },
      });
    }

    // Create policy decision
    const workflow = await prisma.policyWorkflow.findUnique({
      where: { name: sample.workflow },
    });

    if (workflow) {
      const policyVersion = await prisma.policyVersion.findFirst({
        where: { workflowId: workflow.id, isActive: true },
      });

      if (policyVersion) {
        await prisma.policyDecision.create({
          data: {
            fileId: file.id,
            workflowId: workflow.id,
            policyVersionId: policyVersion.id,
            decision,
            rationale,
            matchedRules: JSON.stringify([decision.toLowerCase() + "_rule"]),
          },
        });
      }
    }

    // Create transparency proof for some files
    if (trustReport.integrity.transparency_log_ok) {
      await prisma.transparencyProof.create({
        data: {
          fileId: file.id,
          leafIndex: Math.floor(Math.random() * 10000),
          leafHash: generateHash(`${file.id}_leaf`),
          rootHash: generateHash(`${file.id}_root`),
          treeSize: 10000 + Math.floor(Math.random() * 50000),
          checkpointSig: "checkpoint_" + generateHash(`${file.id}_checkpoint`).substring(0, 32),
          proofJson: JSON.stringify([
            generateHash(`${file.id}_proof_0`),
            generateHash(`${file.id}_proof_1`),
          ]),
        },
      });
    }

    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        action: "INTAKE",
        entityType: "FILE",
        entityId: file.id,
        actor: file.submitter || "system",
        details: JSON.stringify({ filename: sample.name, workflow: sample.workflow }),
        createdAt: uploadDate,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "VERIFY",
        entityType: "FILE",
        entityId: file.id,
        actor: "system",
        details: JSON.stringify({ score, decision }),
        createdAt: new Date(uploadDate.getTime() + 2000),
      },
    });
  }

  console.log(`✅ Created ${SAMPLE_FILES.length} sample files`);
  console.log(`   - ${blockedCount} BLOCKED`);
  console.log(`   - ${warnCount} WARN`);
  console.log(`   - ${SAMPLE_FILES.length - blockedCount - warnCount} ALLOW/REQUIRE`);
  console.log("🌱 Seeding complete!");
}

seed()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
