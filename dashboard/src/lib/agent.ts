/**
 * Oversight AI Agent — Collector, Analyzer, Reporter
 *
 * This module is READ-ONLY with respect to business data.
 * It writes only to AgentReport and AgentAlert tables.
 */

import { PrismaClient } from "@prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentConfig {
  enabled: boolean;
  digestHours: number; // look-back window
  blockThreshold: number; // blocks to trigger BLOCK_SPIKE
  lowConfidenceThreshold: number; // avg score below this = alert
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  enabled: true,
  digestHours: 24,
  blockThreshold: 2,
  lowConfidenceThreshold: 60,
};

export interface CollectedMetrics {
  periodStart: Date;
  periodEnd: Date;
  totalFiles: number;
  newFiles: number;
  decisions: { ALLOW: number; WARN: number; REQUIRE_EXTRA_VERIFICATION: number; BLOCK: number };
  avgConfidence: number;
  failedVerifications: number;
  brokenChains: number;
  policyChanges: number;
  auditEventCount: number;
  topFailedSignals: Array<{ name: string; count: number }>;
  recentBlocks: Array<{ fileId: string; filename: string; decision: string }>;
}

export interface AnalysisResult {
  alerts: Array<{
    alertType: string;
    severity: "WARNING" | "CRITICAL";
    title: string;
    message: string;
    entityType?: string;
    entityId?: string;
  }>;
  recommendations: string[];
  overallSeverity: "INFO" | "WARNING" | "CRITICAL";
}

export interface DigestReport {
  title: string;
  summary: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  metrics: CollectedMetrics;
  analysis: AnalysisResult;
}

// ---------------------------------------------------------------------------
// Collector — reads from existing tables (read-only)
// ---------------------------------------------------------------------------

export async function collectMetrics(
  prisma: PrismaClient,
  config: AgentConfig
): Promise<CollectedMetrics> {
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - config.digestHours * 60 * 60 * 1000);

  // Parallel queries for efficiency
  const [
    totalFiles,
    newFiles,
    decisions,
    signalFailures,
    brokenChains,
    failedVerifications,
    policyChanges,
    auditEventCount,
    recentBlocks,
  ] = await Promise.all([
    // Total files in system
    prisma.fileRecord.count(),

    // New files in period
    prisma.fileRecord.count({
      where: { uploadedAt: { gte: periodStart, lte: periodEnd } },
    }),

    // Decisions in period
    prisma.policyDecision.groupBy({
      by: ["decision"],
      where: { createdAt: { gte: periodStart, lte: periodEnd } },
      _count: { decision: true },
    }),

    // Top failed signals (negative delta) in period
    prisma.signalResult.groupBy({
      by: ["name"],
      where: { delta: { lt: 0 } },
      _count: { name: true },
      orderBy: { _count: { name: "desc" } },
      take: 5,
    }),

    // Broken provenance chains
    prisma.provenanceEvent.count({
      where: { valid: false },
    }),

    // Failed verifications in period
    prisma.fileRecord.count({
      where: {
        status: "FAILED",
        updatedAt: { gte: periodStart, lte: periodEnd },
      },
    }),

    // Policy changes in period
    prisma.auditLog.count({
      where: {
        action: "POLICY_CHANGE",
        createdAt: { gte: periodStart, lte: periodEnd },
      },
    }),

    // Total audit events in period
    prisma.auditLog.count({
      where: { createdAt: { gte: periodStart, lte: periodEnd } },
    }),

    // Recent blocked files
    prisma.policyDecision.findMany({
      where: {
        decision: "BLOCK",
        createdAt: { gte: periodStart, lte: periodEnd },
      },
      include: { file: { select: { id: true, filename: true } } },
      take: 10,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Compute average confidence from trust reports
  const trustReports = await prisma.trustReport.findMany({
    where: { createdAt: { gte: periodStart, lte: periodEnd } },
    select: { json: true },
  });

  let avgConfidence = 0;
  if (trustReports.length > 0) {
    const scores = trustReports.map((r) => {
      try {
        const parsed = JSON.parse(r.json);
        return parsed.reality_confidence?.score ?? 0;
      } catch {
        return 0;
      }
    });
    avgConfidence = Math.round(
      scores.reduce((a: number, b: number) => a + b, 0) / scores.length
    );
  }

  // Map decisions to counts
  const decisionCounts = { ALLOW: 0, WARN: 0, REQUIRE_EXTRA_VERIFICATION: 0, BLOCK: 0 };
  for (const d of decisions) {
    if (d.decision in decisionCounts) {
      decisionCounts[d.decision as keyof typeof decisionCounts] = d._count.decision;
    }
  }

  return {
    periodStart,
    periodEnd,
    totalFiles,
    newFiles,
    decisions: decisionCounts,
    avgConfidence,
    failedVerifications,
    brokenChains,
    policyChanges,
    auditEventCount,
    topFailedSignals: signalFailures.map((s) => ({
      name: s.name,
      count: s._count.name,
    })),
    recentBlocks: recentBlocks.map((b) => ({
      fileId: b.file.id,
      filename: b.file.filename,
      decision: b.decision,
    })),
  };
}

// ---------------------------------------------------------------------------
// Analyzer — heuristic rules
// ---------------------------------------------------------------------------

export function analyzeMetrics(
  metrics: CollectedMetrics,
  config: AgentConfig
): AnalysisResult {
  const alerts: AnalysisResult["alerts"] = [];
  const recommendations: string[] = [];

  // Rule: BLOCK_SPIKE
  if (metrics.decisions.BLOCK >= config.blockThreshold) {
    alerts.push({
      alertType: "BLOCK_SPIKE",
      severity: "CRITICAL",
      title: `Block spike: ${metrics.decisions.BLOCK} files blocked`,
      message: `${metrics.decisions.BLOCK} files were blocked in the last ${config.digestHours}h, exceeding threshold of ${config.blockThreshold}. Recent blocked files: ${metrics.recentBlocks.map((b) => b.filename).join(", ")}.`,
    });
    recommendations.push(
      "Investigate blocked files for common patterns (submitter, workflow, file type)."
    );
  }

  // Rule: LOW_AVG_CONFIDENCE
  if (metrics.avgConfidence > 0 && metrics.avgConfidence < config.lowConfidenceThreshold) {
    alerts.push({
      alertType: "LOW_CONFIDENCE",
      severity: "WARNING",
      title: `Low average confidence: ${metrics.avgConfidence}%`,
      message: `Average confidence score is ${metrics.avgConfidence}%, below the ${config.lowConfidenceThreshold}% threshold. This may indicate systematic issues with file provenance or integrity.`,
    });
    recommendations.push(
      "Review top failing signals to identify systemic verification issues."
    );
  }

  // Rule: CHAIN_INTEGRITY_FAIL
  if (metrics.brokenChains > 0) {
    alerts.push({
      alertType: "CHAIN_BREAK",
      severity: "CRITICAL",
      title: `Provenance chain integrity failures: ${metrics.brokenChains}`,
      message: `${metrics.brokenChains} provenance events have invalid signatures or broken hash chains. This could indicate tampering.`,
    });
    recommendations.push(
      "Audit files with broken provenance chains immediately. Check trusted key registry."
    );
  }

  // Rule: FAILED_VERIFICATION
  if (metrics.failedVerifications > 0) {
    alerts.push({
      alertType: "VERIFICATION_FAILURE",
      severity: "WARNING",
      title: `${metrics.failedVerifications} verification failures`,
      message: `${metrics.failedVerifications} files failed verification in the analysis period.`,
    });
  }

  // Rule: HIGH_VOLUME
  if (metrics.newFiles > 50) {
    alerts.push({
      alertType: "HIGH_VOLUME",
      severity: "WARNING",
      title: `High intake volume: ${metrics.newFiles} files`,
      message: `${metrics.newFiles} files were ingested in the last ${config.digestHours}h. Ensure processing capacity is adequate.`,
    });
  }

  // Rule: NO_ACTIVITY
  if (metrics.newFiles === 0 && metrics.auditEventCount === 0) {
    alerts.push({
      alertType: "NO_ACTIVITY",
      severity: "WARNING",
      title: "No system activity detected",
      message: `No files ingested and no audit events in the last ${config.digestHours}h. This may indicate a system issue or outage.`,
    });
  }

  // Rule: POLICY_CHANGE
  if (metrics.policyChanges > 0) {
    alerts.push({
      alertType: "POLICY_CHANGE",
      severity: "WARNING",
      title: `${metrics.policyChanges} policy change(s)`,
      message: `${metrics.policyChanges} policy modification(s) were made in the analysis period. Verify changes were authorized.`,
    });
  }

  // Determine overall severity
  let overallSeverity: AnalysisResult["overallSeverity"] = "INFO";
  if (alerts.some((a) => a.severity === "CRITICAL")) {
    overallSeverity = "CRITICAL";
  } else if (alerts.some((a) => a.severity === "WARNING")) {
    overallSeverity = "WARNING";
  }

  // General recommendations
  if (metrics.topFailedSignals.length > 0) {
    recommendations.push(
      `Top failing signals: ${metrics.topFailedSignals.map((s) => `${s.name} (${s.count}x)`).join(", ")}.`
    );
  }

  return { alerts, recommendations, overallSeverity };
}

// ---------------------------------------------------------------------------
// Reporter — generates digest and writes to DB
// ---------------------------------------------------------------------------

export function generateDigest(
  metrics: CollectedMetrics,
  analysis: AnalysisResult
): DigestReport {
  const totalDecisions =
    metrics.decisions.ALLOW +
    metrics.decisions.WARN +
    metrics.decisions.REQUIRE_EXTRA_VERIFICATION +
    metrics.decisions.BLOCK;

  const summaryParts: string[] = [];

  summaryParts.push(
    `Analysis period: ${metrics.periodStart.toISOString()} to ${metrics.periodEnd.toISOString()}.`
  );
  summaryParts.push(
    `${metrics.newFiles} new files ingested, ${totalDecisions} policy decisions made.`
  );

  if (totalDecisions > 0) {
    summaryParts.push(
      `Decisions: ${metrics.decisions.ALLOW} allowed, ${metrics.decisions.WARN} warned, ${metrics.decisions.REQUIRE_EXTRA_VERIFICATION} require review, ${metrics.decisions.BLOCK} blocked.`
    );
  }

  if (metrics.avgConfidence > 0) {
    summaryParts.push(`Average confidence score: ${metrics.avgConfidence}%.`);
  }

  if (analysis.alerts.length > 0) {
    summaryParts.push(
      `${analysis.alerts.length} alert(s) generated: ${analysis.alerts.filter((a) => a.severity === "CRITICAL").length} critical, ${analysis.alerts.filter((a) => a.severity === "WARNING").length} warning.`
    );
  } else {
    summaryParts.push("No alerts — all systems operating normally.");
  }

  if (analysis.recommendations.length > 0) {
    summaryParts.push(`Recommendations: ${analysis.recommendations.join(" ")}`);
  }

  return {
    title: `System Digest — ${metrics.periodEnd.toLocaleDateString()}`,
    summary: summaryParts.join(" "),
    severity: analysis.overallSeverity,
    metrics,
    analysis,
  };
}

// ---------------------------------------------------------------------------
// Main entry point — run the full pipeline
// ---------------------------------------------------------------------------

export async function runOversightAgent(
  prisma: PrismaClient,
  config: AgentConfig = DEFAULT_AGENT_CONFIG
): Promise<{ reportId: string; alertIds: string[] }> {
  if (!config.enabled) {
    throw new Error("Oversight agent is disabled");
  }

  // 1. Collect metrics (read-only)
  const metrics = await collectMetrics(prisma, config);

  // 2. Analyze with heuristics
  const analysis = analyzeMetrics(metrics, config);

  // 3. Generate digest
  const digest = generateDigest(metrics, analysis);

  // 4. Write report (only writes to AgentReport table)
  const report = await prisma.agentReport.create({
    data: {
      reportType: "DAILY_DIGEST",
      severity: digest.severity,
      title: digest.title,
      summary: digest.summary,
      detailsJson: JSON.stringify({
        metrics: {
          totalFiles: metrics.totalFiles,
          newFiles: metrics.newFiles,
          decisions: metrics.decisions,
          avgConfidence: metrics.avgConfidence,
          failedVerifications: metrics.failedVerifications,
          brokenChains: metrics.brokenChains,
          policyChanges: metrics.policyChanges,
          auditEventCount: metrics.auditEventCount,
          topFailedSignals: metrics.topFailedSignals,
        },
        analysis: {
          alerts: analysis.alerts,
          recommendations: analysis.recommendations,
        },
      }),
      eventCount: metrics.auditEventCount + metrics.newFiles,
      periodStart: metrics.periodStart,
      periodEnd: metrics.periodEnd,
      generatedBy: "heuristic",
    },
  });

  // 5. Write individual alerts (only writes to AgentAlert table)
  const alertIds: string[] = [];
  for (const alert of analysis.alerts) {
    const created = await prisma.agentAlert.create({
      data: {
        alertType: alert.alertType,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        entityType: alert.entityType ?? null,
        entityId: alert.entityId ?? null,
      },
    });
    alertIds.push(created.id);
  }

  // 6. Log the agent run to audit log
  await prisma.auditLog.create({
    data: {
      action: "AGENT_RUN",
      entityType: "SYSTEM",
      entityId: report.id,
      actor: "oversight-agent",
      details: JSON.stringify({
        reportType: "DAILY_DIGEST",
        alertCount: alertIds.length,
        severity: digest.severity,
      }),
    },
  });

  return { reportId: report.id, alertIds };
}
