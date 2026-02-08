import { describe, it, expect } from "vitest";
import {
  computeSignals,
  computeConfidenceScore,
  determineHumanOrigin,
  evaluatePolicy,
  DEFAULT_POLICIES,
} from "../lib/scoring";
import { getGradeFromScore } from "../lib/utils";
import type { ProvenanceEvent } from "../lib/types";

describe("Scoring Engine", () => {
  describe("computeConfidenceScore", () => {
    it("should compute score from signals", () => {
      const signals = [
        { name: "test1", delta: 20, severity: "HIGH" as const, explanation: "", evidence: {} },
        { name: "test2", delta: 15, severity: "MEDIUM" as const, explanation: "", evidence: {} },
        { name: "test3", delta: -10, severity: "LOW" as const, explanation: "", evidence: {} },
      ];

      const score = computeConfidenceScore(signals);
      // Base 50 + 20 + 15 - 10 = 75
      expect(score).toBe(75);
    });

    it("should clamp score between 0 and 100", () => {
      const highSignals = [
        { name: "test", delta: 100, severity: "HIGH" as const, explanation: "", evidence: {} },
      ];
      expect(computeConfidenceScore(highSignals)).toBe(100);

      const lowSignals = [
        { name: "test", delta: -100, severity: "HIGH" as const, explanation: "", evidence: {} },
      ];
      expect(computeConfidenceScore(lowSignals)).toBe(0);
    });
  });

  describe("getGradeFromScore", () => {
    it("should return correct grade for each range", () => {
      expect(getGradeFromScore(95)).toBe("A");
      expect(getGradeFromScore(90)).toBe("A");
      expect(getGradeFromScore(85)).toBe("B");
      expect(getGradeFromScore(80)).toBe("B");
      expect(getGradeFromScore(75)).toBe("C");
      expect(getGradeFromScore(70)).toBe("C");
      expect(getGradeFromScore(65)).toBe("D");
      expect(getGradeFromScore(60)).toBe("D");
      expect(getGradeFromScore(55)).toBe("F");
      expect(getGradeFromScore(0)).toBe("F");
    });
  });

  describe("determineHumanOrigin", () => {
    it("should return YES for verified human capture without AI edit", () => {
      const signals = [
        { name: "capture_event_present", delta: 15, severity: "HIGH" as const, explanation: "", evidence: {} },
        { name: "ai_edit_detection", delta: 5, severity: "CRITICAL" as const, explanation: "", evidence: {} },
      ];
      const events: ProvenanceEvent[] = [
        {
          idx: 0,
          eventType: "CAPTURE",
          eventTime: new Date().toISOString(),
          actorKeyId: "device_1",
          eventHash: "abc123",
          prevEventHash: null,
          signature: "sig",
          valid: true,
          metadata: {},
        },
      ];

      const result = determineHumanOrigin(signals, events);
      expect(result.value).toBe("YES");
    });

    it("should return NO when AI edit is detected", () => {
      const signals = [
        { name: "capture_event_present", delta: 15, severity: "HIGH" as const, explanation: "", evidence: {} },
        { name: "ai_edit_detection", delta: -30, severity: "CRITICAL" as const, explanation: "", evidence: {} },
      ];
      const events: ProvenanceEvent[] = [
        {
          idx: 0,
          eventType: "AI_EDIT",
          eventTime: new Date().toISOString(),
          actorKeyId: "ai_service",
          eventHash: "abc123",
          prevEventHash: null,
          signature: "sig",
          valid: true,
          metadata: {},
        },
      ];

      const result = determineHumanOrigin(signals, events);
      expect(result.value).toBe("NO");
    });

    it("should return UNAVAILABLE when no capture event", () => {
      const signals = [
        { name: "capture_event_present", delta: -10, severity: "HIGH" as const, explanation: "", evidence: {} },
        { name: "ai_edit_detection", delta: 5, severity: "CRITICAL" as const, explanation: "", evidence: {} },
      ];
      const events: ProvenanceEvent[] = [];

      const result = determineHumanOrigin(signals, events);
      expect(result.value).toBe("UNAVAILABLE");
    });
  });

  describe("evaluatePolicy", () => {
    const policy = {
      min_confidence: 70,
      require_human_origin: false,
      require_transparency_log: false,
      decision_rules: [
        { id: "high", condition: "confidence >= 90", decision: "ALLOW" as const, rationale: "High confidence" },
        { id: "medium", condition: "confidence >= 70", decision: "WARN" as const, rationale: "Medium confidence" },
        { id: "low", condition: "default", decision: "BLOCK" as const, rationale: "Low confidence" },
      ],
    };

    it("should return ALLOW for high confidence", () => {
      const result = evaluatePolicy(95, "YES", true, policy);
      expect(result.decision).toBe("ALLOW");
      expect(result.matchedRules).toContain("high");
    });

    it("should return WARN for medium confidence", () => {
      const result = evaluatePolicy(75, "YES", true, policy);
      expect(result.decision).toBe("WARN");
      expect(result.matchedRules).toContain("medium");
    });

    it("should return BLOCK for low confidence", () => {
      const result = evaluatePolicy(50, "YES", true, policy);
      expect(result.decision).toBe("BLOCK");
      expect(result.matchedRules).toContain("low");
    });

    it("should enforce require_human_origin when set", () => {
      const strictPolicy = {
        ...policy,
        require_human_origin: true,
      };
      const result = evaluatePolicy(95, "NO", true, strictPolicy);
      expect(result.decision).toBe("REQUIRE_EXTRA_VERIFICATION");
      expect(result.matchedRules).toContain("require_human_origin");
    });

    it("should enforce require_transparency_log when set", () => {
      const strictPolicy = {
        ...policy,
        require_transparency_log: true,
      };
      const result = evaluatePolicy(95, "YES", false, strictPolicy);
      expect(result.decision).toBe("WARN");
      expect(result.matchedRules).toContain("require_transparency_log");
    });
  });

  describe("computeSignals", () => {
    it("should compute all 10 signals", () => {
      const ctx = {
        sha256: "abc123def456",
        storedSha256: "abc123def456",
        mime: "image/jpeg",
        size: 1000000,
        uploadedAt: new Date(),
        provenanceEvents: [
          {
            idx: 0,
            eventType: "CAPTURE" as const,
            eventTime: new Date().toISOString(),
            actorKeyId: "device_12345678",
            eventHash: "hash123",
            prevEventHash: null,
            signature: "sig",
            valid: true,
            metadata: {},
          },
        ],
        hasTransparencyProof: true,
        transparencyProofValid: true,
        signatures: [{ keyId: "key1", valid: true }],
        hasAiEdit: false,
      };

      const signals = computeSignals(ctx);
      expect(signals.length).toBe(10);
      expect(signals.map((s) => s.name)).toContain("payload_hash_match");
      expect(signals.map((s) => s.name)).toContain("ai_edit_detection");
    });

    it("should penalize hash mismatch severely", () => {
      const ctx = {
        sha256: "abc123",
        storedSha256: "different",
        mime: "image/jpeg",
        size: 1000000,
        uploadedAt: new Date(),
        provenanceEvents: [],
        hasTransparencyProof: false,
        transparencyProofValid: false,
        signatures: [],
        hasAiEdit: false,
      };

      const signals = computeSignals(ctx);
      const hashSignal = signals.find((s) => s.name === "payload_hash_match");
      expect(hashSignal?.delta).toBe(-100);
    });
  });

  describe("DEFAULT_POLICIES", () => {
    it("should have policies for all workflows", () => {
      expect(DEFAULT_POLICIES["vendor-bank-change"]).toBeDefined();
      expect(DEFAULT_POLICIES["wire-transfer"]).toBeDefined();
      expect(DEFAULT_POLICIES["hr-offer-letter"]).toBeDefined();
      expect(DEFAULT_POLICIES["insurance-claim"]).toBeDefined();
      expect(DEFAULT_POLICIES["content-publishing"]).toBeDefined();
    });

    it("should have wire-transfer as strictest policy", () => {
      const wirePolicy = DEFAULT_POLICIES["wire-transfer"];
      expect(wirePolicy.min_confidence).toBe(90);
      expect(wirePolicy.require_human_origin).toBe(true);
      expect(wirePolicy.require_transparency_log).toBe(true);
    });
  });
});
