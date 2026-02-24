import { describe, it, expect } from "vitest";
import {
  analyzeMetrics,
  generateDigest,
  DEFAULT_AGENT_CONFIG,
  type CollectedMetrics,
  type AgentConfig,
} from "../lib/agent";

function makeMetrics(overrides: Partial<CollectedMetrics> = {}): CollectedMetrics {
  return {
    periodStart: new Date("2024-01-01T00:00:00Z"),
    periodEnd: new Date("2024-01-02T00:00:00Z"),
    totalFiles: 20,
    newFiles: 5,
    decisions: { ALLOW: 12, WARN: 5, REQUIRE_EXTRA_VERIFICATION: 2, BLOCK: 1 },
    avgConfidence: 75,
    failedVerifications: 0,
    brokenChains: 0,
    policyChanges: 0,
    auditEventCount: 10,
    topFailedSignals: [],
    recentBlocks: [],
    ...overrides,
  };
}

describe("analyzeMetrics", () => {
  it("returns no alerts for healthy metrics", () => {
    const metrics = makeMetrics();
    const result = analyzeMetrics(metrics, DEFAULT_AGENT_CONFIG);

    expect(result.overallSeverity).toBe("INFO");
    expect(result.alerts).toHaveLength(0);
  });

  it("triggers BLOCK_SPIKE when blocks exceed threshold", () => {
    const metrics = makeMetrics({
      decisions: { ALLOW: 10, WARN: 3, REQUIRE_EXTRA_VERIFICATION: 2, BLOCK: 5 },
      recentBlocks: [
        { fileId: "f1", filename: "bad_file.pdf", decision: "BLOCK" },
        { fileId: "f2", filename: "suspicious.jpg", decision: "BLOCK" },
      ],
    });
    const result = analyzeMetrics(metrics, DEFAULT_AGENT_CONFIG);

    expect(result.alerts.some((a) => a.alertType === "BLOCK_SPIKE")).toBe(true);
    expect(result.overallSeverity).toBe("CRITICAL");
  });

  it("triggers LOW_CONFIDENCE when average is below threshold", () => {
    const metrics = makeMetrics({ avgConfidence: 45 });
    const result = analyzeMetrics(metrics, DEFAULT_AGENT_CONFIG);

    expect(result.alerts.some((a) => a.alertType === "LOW_CONFIDENCE")).toBe(true);
    expect(result.overallSeverity).toBe("WARNING");
  });

  it("triggers CHAIN_BREAK for broken provenance chains", () => {
    const metrics = makeMetrics({ brokenChains: 3 });
    const result = analyzeMetrics(metrics, DEFAULT_AGENT_CONFIG);

    expect(result.alerts.some((a) => a.alertType === "CHAIN_BREAK")).toBe(true);
    expect(result.overallSeverity).toBe("CRITICAL");
  });

  it("triggers VERIFICATION_FAILURE for failed files", () => {
    const metrics = makeMetrics({ failedVerifications: 2 });
    const result = analyzeMetrics(metrics, DEFAULT_AGENT_CONFIG);

    expect(result.alerts.some((a) => a.alertType === "VERIFICATION_FAILURE")).toBe(true);
  });

  it("triggers NO_ACTIVITY when nothing happened", () => {
    const metrics = makeMetrics({ newFiles: 0, auditEventCount: 0 });
    const result = analyzeMetrics(metrics, DEFAULT_AGENT_CONFIG);

    expect(result.alerts.some((a) => a.alertType === "NO_ACTIVITY")).toBe(true);
  });

  it("triggers HIGH_VOLUME for >50 files", () => {
    const metrics = makeMetrics({ newFiles: 75 });
    const result = analyzeMetrics(metrics, DEFAULT_AGENT_CONFIG);

    expect(result.alerts.some((a) => a.alertType === "HIGH_VOLUME")).toBe(true);
  });

  it("triggers POLICY_CHANGE when policies were modified", () => {
    const metrics = makeMetrics({ policyChanges: 2 });
    const result = analyzeMetrics(metrics, DEFAULT_AGENT_CONFIG);

    expect(result.alerts.some((a) => a.alertType === "POLICY_CHANGE")).toBe(true);
  });

  it("respects custom config thresholds", () => {
    const config: AgentConfig = {
      enabled: true,
      digestHours: 24,
      blockThreshold: 10, // higher threshold
      lowConfidenceThreshold: 30, // lower threshold
    };
    const metrics = makeMetrics({
      decisions: { ALLOW: 5, WARN: 2, REQUIRE_EXTRA_VERIFICATION: 1, BLOCK: 5 },
      avgConfidence: 45,
    });
    const result = analyzeMetrics(metrics, config);

    // 5 blocks < 10 threshold, so no BLOCK_SPIKE
    expect(result.alerts.some((a) => a.alertType === "BLOCK_SPIKE")).toBe(false);
    // 45 > 30 threshold, so no LOW_CONFIDENCE
    expect(result.alerts.some((a) => a.alertType === "LOW_CONFIDENCE")).toBe(false);
  });

  it("includes recommendations for top failed signals", () => {
    const metrics = makeMetrics({
      topFailedSignals: [
        { name: "payload_hash_match", count: 5 },
        { name: "signature_validity", count: 3 },
      ],
    });
    const result = analyzeMetrics(metrics, DEFAULT_AGENT_CONFIG);

    expect(result.recommendations.some((r) => r.includes("payload_hash_match"))).toBe(true);
  });
});

describe("generateDigest", () => {
  it("produces a digest with correct structure", () => {
    const metrics = makeMetrics();
    const analysis = analyzeMetrics(metrics, DEFAULT_AGENT_CONFIG);
    const digest = generateDigest(metrics, analysis);

    expect(digest.title).toContain("System Digest");
    expect(digest.summary).toContain("5 new files ingested");
    expect(digest.severity).toBe("INFO");
  });

  it("includes alert counts in summary when alerts exist", () => {
    const metrics = makeMetrics({ brokenChains: 1 });
    const analysis = analyzeMetrics(metrics, DEFAULT_AGENT_CONFIG);
    const digest = generateDigest(metrics, analysis);

    expect(digest.severity).toBe("CRITICAL");
    expect(digest.summary).toContain("alert(s) generated");
    expect(digest.summary).toContain("1 critical");
  });

  it("reports healthy state when no alerts", () => {
    const metrics = makeMetrics();
    const analysis = analyzeMetrics(metrics, DEFAULT_AGENT_CONFIG);
    const digest = generateDigest(metrics, analysis);

    expect(digest.summary).toContain("No alerts");
  });

  it("includes decision breakdown in summary", () => {
    const metrics = makeMetrics();
    const analysis = analyzeMetrics(metrics, DEFAULT_AGENT_CONFIG);
    const digest = generateDigest(metrics, analysis);

    expect(digest.summary).toContain("12 allowed");
    expect(digest.summary).toContain("5 warned");
    expect(digest.summary).toContain("1 blocked");
  });
});

describe("DEFAULT_AGENT_CONFIG", () => {
  it("has sensible defaults", () => {
    expect(DEFAULT_AGENT_CONFIG.enabled).toBe(true);
    expect(DEFAULT_AGENT_CONFIG.digestHours).toBe(24);
    expect(DEFAULT_AGENT_CONFIG.blockThreshold).toBe(2);
    expect(DEFAULT_AGENT_CONFIG.lowConfidenceThreshold).toBe(60);
  });
});
