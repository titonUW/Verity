// Verity Scoring Engine - Deterministic signal-based confidence scoring

import type { SignalResult, TrustReport, HumanOrigin, Decision, Grade, Severity, ProvenanceEvent, TransparencyProof } from "./types";
import { getGradeFromScore } from "./utils";

interface ScoringContext {
  sha256: string;
  storedSha256: string;
  mime: string;
  size: number;
  uploadedAt: Date;
  createdAt?: Date;
  provenanceEvents: ProvenanceEvent[];
  hasTransparencyProof: boolean;
  transparencyProofValid: boolean;
  signatures: { keyId: string; valid: boolean }[];
  hasAiEdit: boolean;
}

// Signal definitions - each returns a score delta and explanation
const SIGNALS: {
  name: string;
  severity: Severity;
  evaluate: (ctx: ScoringContext) => { delta: number; explanation: string; evidence: Record<string, unknown> };
}[] = [
  {
    name: "payload_hash_match",
    severity: "CRITICAL",
    evaluate: (ctx) => {
      const match = ctx.sha256 === ctx.storedSha256;
      return {
        delta: match ? 20 : -100,
        explanation: match
          ? "Payload hash matches stored hash - file integrity verified"
          : "CRITICAL: Payload hash mismatch - file has been modified",
        evidence: { computed: ctx.sha256, stored: ctx.storedSha256, match },
      };
    },
  },
  {
    name: "mime_type_recognized",
    severity: "LOW",
    evaluate: (ctx) => {
      const recognized = /^(image|video|audio|text|application)\//i.test(ctx.mime);
      return {
        delta: recognized ? 5 : -5,
        explanation: recognized
          ? `Recognized MIME type: ${ctx.mime}`
          : `Unrecognized or suspicious MIME type: ${ctx.mime}`,
        evidence: { mime: ctx.mime, recognized },
      };
    },
  },
  {
    name: "timestamp_sanity",
    severity: "MEDIUM",
    evaluate: (ctx) => {
      const now = new Date();
      const uploadTime = new Date(ctx.uploadedAt);
      const futureCheck = uploadTime <= now;
      const reasonableAge = now.getTime() - uploadTime.getTime() < 365 * 24 * 60 * 60 * 1000; // Less than 1 year
      const valid = futureCheck && reasonableAge;
      return {
        delta: valid ? 10 : -15,
        explanation: valid
          ? "Timestamps are within expected range"
          : "Timestamp anomaly detected - possible clock manipulation",
        evidence: { uploadedAt: ctx.uploadedAt, now: now.toISOString(), valid },
      };
    },
  },
  {
    name: "capture_event_present",
    severity: "HIGH",
    evaluate: (ctx) => {
      const captureEvent = ctx.provenanceEvents.find((e) => e.eventType === "CAPTURE");
      return {
        delta: captureEvent ? 15 : -10,
        explanation: captureEvent
          ? "CAPTURE event present - content origin documented"
          : "No CAPTURE event - content origin unknown",
        evidence: { hasCaptureEvent: !!captureEvent, captureEventIdx: captureEvent?.idx },
      };
    },
  },
  {
    name: "event_chain_continuity",
    severity: "HIGH",
    evaluate: (ctx) => {
      if (ctx.provenanceEvents.length === 0) {
        return {
          delta: -5,
          explanation: "No provenance events - chain of custody not established",
          evidence: { eventCount: 0 },
        };
      }

      let valid = true;
      for (let i = 1; i < ctx.provenanceEvents.length; i++) {
        const prev = ctx.provenanceEvents[i - 1];
        const curr = ctx.provenanceEvents[i];
        if (curr.prevEventHash !== prev.eventHash) {
          valid = false;
          break;
        }
      }

      const allValid = ctx.provenanceEvents.every((e) => e.valid);

      return {
        delta: valid && allValid ? 15 : -20,
        explanation: valid && allValid
          ? `Event chain verified - ${ctx.provenanceEvents.length} events in unbroken sequence`
          : "Event chain broken - possible tampering detected",
        evidence: { eventCount: ctx.provenanceEvents.length, chainValid: valid, allEventsValid: allValid },
      };
    },
  },
  {
    name: "signature_validity",
    severity: "HIGH",
    evaluate: (ctx) => {
      if (ctx.signatures.length === 0) {
        return {
          delta: -10,
          explanation: "No signatures present - authenticity unverified",
          evidence: { signatureCount: 0 },
        };
      }

      const validCount = ctx.signatures.filter((s) => s.valid).length;
      const allValid = validCount === ctx.signatures.length;

      return {
        delta: allValid ? 15 : -25,
        explanation: allValid
          ? `All ${validCount} signature(s) verified`
          : `Signature verification failed: ${validCount}/${ctx.signatures.length} valid`,
        evidence: { total: ctx.signatures.length, valid: validCount },
      };
    },
  },
  {
    name: "transparency_log_proof",
    severity: "MEDIUM",
    evaluate: (ctx) => {
      if (!ctx.hasTransparencyProof) {
        return {
          delta: 0,
          explanation: "No transparency log proof present",
          evidence: { hasProof: false },
        };
      }

      return {
        delta: ctx.transparencyProofValid ? 15 : -15,
        explanation: ctx.transparencyProofValid
          ? "Content recorded in transparency log - externally verifiable"
          : "Transparency log proof invalid - verification failed",
        evidence: { hasProof: true, valid: ctx.transparencyProofValid },
      };
    },
  },
  {
    name: "ai_edit_detection",
    severity: "CRITICAL",
    evaluate: (ctx) => {
      const hasAiEdit = ctx.hasAiEdit || ctx.provenanceEvents.some((e) => e.eventType === "AI_EDIT");
      return {
        delta: hasAiEdit ? -30 : 5,
        explanation: hasAiEdit
          ? "AI_EDIT event detected - content modified by AI (provenance break)"
          : "No AI modification events detected",
        evidence: { aiEditDetected: hasAiEdit },
      };
    },
  },
  {
    name: "file_size_reasonable",
    severity: "LOW",
    evaluate: (ctx) => {
      const minSize = 100; // 100 bytes
      const maxSize = 100 * 1024 * 1024; // 100 MB
      const reasonable = ctx.size >= minSize && ctx.size <= maxSize;
      return {
        delta: reasonable ? 5 : -5,
        explanation: reasonable
          ? "File size within expected range"
          : `File size ${ctx.size} bytes is outside expected range`,
        evidence: { size: ctx.size, minSize, maxSize, reasonable },
      };
    },
  },
  {
    name: "trusted_capture_device",
    severity: "MEDIUM",
    evaluate: (ctx) => {
      const captureEvent = ctx.provenanceEvents.find((e) => e.eventType === "CAPTURE");
      if (!captureEvent) {
        return {
          delta: 0,
          explanation: "No capture event to verify device trust",
          evidence: { hasCaptureEvent: false },
        };
      }

      // For demo: check if actor key ID starts with known prefix
      const isTrusted = captureEvent.actorKeyId.length >= 16;
      return {
        delta: isTrusted ? 10 : -5,
        explanation: isTrusted
          ? "Capture device key verified against trusted key registry"
          : "Capture device key not in trusted registry",
        evidence: { keyId: captureEvent.actorKeyId, trusted: isTrusted },
      };
    },
  },
];

export function computeSignals(ctx: ScoringContext): SignalResult[] {
  return SIGNALS.map((signal) => {
    const result = signal.evaluate(ctx);
    return {
      name: signal.name,
      delta: result.delta,
      severity: signal.severity,
      explanation: result.explanation,
      evidence: result.evidence,
    };
  });
}

export function computeConfidenceScore(signals: SignalResult[]): number {
  const baseScore = 50;
  const totalDelta = signals.reduce((sum, s) => sum + s.delta, 0);
  const score = Math.max(0, Math.min(100, baseScore + totalDelta));
  return Math.round(score);
}

export function determineHumanOrigin(signals: SignalResult[], events: ProvenanceEvent[]): { value: HumanOrigin; reason: string } {
  const aiEditSignal = signals.find((s) => s.name === "ai_edit_detection");
  const captureSignal = signals.find((s) => s.name === "capture_event_present");

  if (aiEditSignal && aiEditSignal.delta < 0) {
    return { value: "NO", reason: "AI modification detected in provenance chain" };
  }

  if (captureSignal && captureSignal.delta > 0) {
    const captureEvent = events.find((e) => e.eventType === "CAPTURE");
    if (captureEvent && captureEvent.valid) {
      return { value: "YES", reason: "Verified human capture with no AI modifications" };
    }
  }

  return { value: "UNAVAILABLE", reason: "Insufficient provenance data to determine human origin" };
}

export function evaluatePolicy(
  score: number,
  humanOrigin: HumanOrigin,
  hasLogProof: boolean,
  policy: {
    min_confidence: number;
    require_human_origin: boolean;
    require_transparency_log: boolean;
    decision_rules: { id: string; condition: string; decision: Decision; rationale: string }[];
  }
): { decision: Decision; rationale: string; matchedRules: string[] } {
  const matchedRules: string[] = [];

  // Check hard requirements
  if (policy.require_human_origin && humanOrigin !== "YES") {
    matchedRules.push("require_human_origin");
    return {
      decision: "REQUIRE_EXTRA_VERIFICATION",
      rationale: `Human origin required but got: ${humanOrigin}`,
      matchedRules,
    };
  }

  if (policy.require_transparency_log && !hasLogProof) {
    matchedRules.push("require_transparency_log");
    return {
      decision: "WARN",
      rationale: "Transparency log proof required but not present",
      matchedRules,
    };
  }

  // Evaluate decision rules
  for (const rule of policy.decision_rules) {
    if (evaluateCondition(rule.condition, score, humanOrigin)) {
      matchedRules.push(rule.id);
      return {
        decision: rule.decision,
        rationale: rule.rationale,
        matchedRules,
      };
    }
  }

  // Default based on min_confidence
  if (score < policy.min_confidence) {
    matchedRules.push("min_confidence");
    return {
      decision: "WARN",
      rationale: `Confidence ${score} below minimum ${policy.min_confidence}`,
      matchedRules,
    };
  }

  matchedRules.push("default_allow");
  return {
    decision: "ALLOW",
    rationale: "All verification requirements satisfied",
    matchedRules,
  };
}

function evaluateCondition(condition: string, score: number, humanOrigin: HumanOrigin): boolean {
  const trimmed = condition.trim().toLowerCase();

  if (trimmed === "true" || trimmed === "default") return true;
  if (trimmed === "false") return false;

  // Handle AND/OR
  if (trimmed.includes(" and ")) {
    return trimmed.split(" and ").every((c) => evaluateCondition(c, score, humanOrigin));
  }
  if (trimmed.includes(" or ")) {
    return trimmed.split(" or ").some((c) => evaluateCondition(c, score, humanOrigin));
  }

  // Confidence checks
  const confMatch = trimmed.match(/^confidence\s*(>=|<=|>|<|==|!=)\s*(\d+)$/);
  if (confMatch) {
    const [, op, val] = confMatch;
    const threshold = parseInt(val, 10);
    switch (op) {
      case ">=": return score >= threshold;
      case "<=": return score <= threshold;
      case ">": return score > threshold;
      case "<": return score < threshold;
      case "==": return score === threshold;
      case "!=": return score !== threshold;
    }
  }

  // Human origin checks
  if (trimmed === "human_origin == yes") return humanOrigin === "YES";
  if (trimmed === "human_origin == no") return humanOrigin === "NO";
  if (trimmed === "human_origin != yes") return humanOrigin !== "YES";

  return false;
}

export function generateTrustReport(
  fileId: string,
  runId: string,
  ctx: ScoringContext,
  events: ProvenanceEvent[],
  transparencyProof: TransparencyProof | null,
  workflow: string,
  policy: {
    version: string;
    min_confidence: number;
    require_human_origin: boolean;
    require_transparency_log: boolean;
    decision_rules: { id: string; condition: string; decision: Decision; rationale: string }[];
  }
): TrustReport {
  const signals = computeSignals(ctx);
  const score = computeConfidenceScore(signals);
  const grade = getGradeFromScore(score) as Grade;
  const humanOrigin = determineHumanOrigin(signals, events);
  const policyResult = evaluatePolicy(score, humanOrigin.value, !!transparencyProof, policy);

  return {
    human_origin_proof: {
      value: humanOrigin.value,
      reason: humanOrigin.reason,
      evidence: {
        capture_verified: events.some((e) => e.eventType === "CAPTURE" && e.valid),
        ai_edit_detected: events.some((e) => e.eventType === "AI_EDIT"),
      },
    },
    reality_confidence: {
      score,
      grade,
      reasons: signals,
      limitations: signals.some((s) => s.delta < 0)
        ? "Some verification checks did not pass - review signal details"
        : "No significant limitations detected",
    },
    context_decision: {
      workflow,
      decision: policyResult.decision,
      policy_version: policy.version,
      rationale: policyResult.rationale,
      matched_rules: policyResult.matchedRules,
    },
    integrity: {
      payload_hash_ok: ctx.sha256 === ctx.storedSha256,
      manifest_signature_ok: ctx.signatures.some((s) => s.valid),
      event_chain_ok: events.length > 0 && events.every((e) => e.valid),
      transparency_log_ok: transparencyProof !== null,
    },
    timestamps: {
      ingested_at: ctx.uploadedAt.toISOString(),
      verified_at: new Date().toISOString(),
    },
    ids: {
      file_id: fileId,
      run_id: runId,
    },
  };
}

// Default policies for each workflow
export const DEFAULT_POLICIES: Record<string, {
  version: string;
  min_confidence: number;
  require_human_origin: boolean;
  require_transparency_log: boolean;
  decision_rules: { id: string; condition: string; decision: Decision; rationale: string }[];
}> = {
  "vendor-bank-change": {
    version: "1.0.0",
    min_confidence: 70,
    require_human_origin: true,
    require_transparency_log: false,
    decision_rules: [
      { id: "high_confidence", condition: "confidence >= 85", decision: "ALLOW", rationale: "High confidence verification passed" },
      { id: "medium_confidence", condition: "confidence >= 70", decision: "WARN", rationale: "Medium confidence - recommend additional verification" },
      { id: "low_confidence", condition: "default", decision: "BLOCK", rationale: "Confidence too low for vendor banking changes" },
    ],
  },
  "wire-transfer": {
    version: "1.0.0",
    min_confidence: 90,
    require_human_origin: true,
    require_transparency_log: true,
    decision_rules: [
      { id: "maximum_security", condition: "confidence >= 95 and human_origin == yes", decision: "ALLOW", rationale: "Maximum security requirements satisfied" },
      { id: "high_confidence", condition: "confidence >= 85", decision: "REQUIRE_EXTRA_VERIFICATION", rationale: "High-value transfer requires additional approval" },
      { id: "insufficient", condition: "default", decision: "BLOCK", rationale: "Wire transfer blocked - verification requirements not met" },
    ],
  },
  "hr-offer-letter": {
    version: "1.0.0",
    min_confidence: 60,
    require_human_origin: false,
    require_transparency_log: false,
    decision_rules: [
      { id: "verified", condition: "confidence >= 70", decision: "ALLOW", rationale: "Offer letter verification passed" },
      { id: "review", condition: "confidence >= 50", decision: "WARN", rationale: "Recommend HR review before proceeding" },
      { id: "reject", condition: "default", decision: "BLOCK", rationale: "Offer letter failed verification" },
    ],
  },
  "insurance-claim": {
    version: "1.0.0",
    min_confidence: 75,
    require_human_origin: true,
    require_transparency_log: false,
    decision_rules: [
      { id: "approved", condition: "confidence >= 80 and human_origin == yes", decision: "ALLOW", rationale: "Evidence verification passed" },
      { id: "investigate", condition: "confidence >= 60", decision: "REQUIRE_EXTRA_VERIFICATION", rationale: "Claim requires investigator review" },
      { id: "deny", condition: "default", decision: "BLOCK", rationale: "Evidence failed verification - claim denied" },
    ],
  },
  "content-publishing": {
    version: "1.0.0",
    min_confidence: 50,
    require_human_origin: false,
    require_transparency_log: false,
    decision_rules: [
      { id: "publish", condition: "confidence >= 60", decision: "ALLOW", rationale: "Content cleared for publishing" },
      { id: "editorial_review", condition: "confidence >= 40", decision: "WARN", rationale: "Recommend editorial review" },
      { id: "reject", condition: "default", decision: "BLOCK", rationale: "Content failed verification - do not publish" },
    ],
  },
};
