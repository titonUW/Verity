"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  User,
  Shield,
  FileText,
  Link as LinkIcon,
  Download,
  Clock,
  Key,
  ArrowRight,
} from "lucide-react";
import { formatDate, formatBytes, truncateHash, getGradeColor } from "@/lib/utils";

interface FileDetail {
  id: string;
  filename: string;
  mime: string;
  size: number;
  sha256: string;
  uploadedAt: string;
  workflow: string;
  tags: string[];
  status: string;
  submitter: string | null;
  trustReport: {
    human_origin_proof: {
      value: string;
      reason: string;
      evidence: Record<string, unknown>;
    };
    reality_confidence: {
      score: number;
      grade: string;
      reasons: Array<{
        name: string;
        delta: number;
        severity: string;
        explanation: string;
        evidence: Record<string, unknown>;
      }>;
      limitations: string;
    };
    context_decision: {
      workflow: string;
      decision: string;
      policy_version: string;
      rationale: string;
      matched_rules: string[];
    };
    integrity: {
      payload_hash_ok: boolean;
      manifest_signature_ok: boolean;
      event_chain_ok: boolean;
      transparency_log_ok: boolean;
    };
    timestamps: {
      ingested_at: string;
      verified_at: string;
    };
  } | null;
  provenanceEvents: Array<{
    idx: number;
    eventType: string;
    eventTime: string;
    actorKeyId: string;
    eventHash: string;
    prevEventHash: string | null;
    signature: string;
    valid: boolean;
    metadata: Record<string, unknown>;
  }>;
  signals: Array<{
    name: string;
    delta: number;
    severity: string;
    explanation: string;
    evidence: Record<string, unknown>;
  }>;
  transparencyProof: {
    leafIndex: number;
    leafHash: string;
    rootHash: string;
    treeSize: number;
    checkpointSig: string;
    proof: string[];
  } | null;
  policyDecision: {
    decision: string;
    rationale: string;
    matchedRules: string[];
    workflowName: string;
    policyVersion: string;
  } | null;
}

function IntegrityCheck({ label, passed }: { label: string; passed: boolean }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm">{label}</span>
      {passed ? (
        <Badge variant="success" className="gap-1">
          <CheckCircle className="w-3 h-3" /> PASS
        </Badge>
      ) : (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="w-3 h-3" /> FAIL
        </Badge>
      )}
    </div>
  );
}

export default function FileDetailPage() {
  const params = useParams();
  const [file, setFile] = useState<FileDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFile() {
      try {
        const res = await fetch(`/api/files/${params.id}`);
        if (res.ok) {
          const data = await res.json();
          setFile(data);
        }
      } catch (error) {
        console.error("Failed to fetch file:", error);
      } finally {
        setLoading(false);
      }
    }

    if (params.id) {
      fetchFile();
    }
  }, [params.id]);

  const exportBundle = () => {
    if (!file) return;

    const bundle = {
      version: "1.0",
      file: {
        sha256: file.sha256,
        filename: file.filename,
        size: file.size,
      },
      trust_report: file.trustReport,
      transparency_proof: file.transparencyProof,
      public_keys: {
        log_public_key: "demo_log_public_key",
      },
      verification_instructions:
        "1. Compute SHA-256 of your file\n2. Compare with bundle sha256\n3. Verify Merkle inclusion proof against checkpoint\n4. Verify checkpoint signature with log public key",
    };

    const blob = new Blob([JSON.stringify(bundle, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${file.filename}-verification-bundle.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <DashboardLayout title="Loading...">
        <div className="text-center py-12 text-[var(--foreground-muted)]">
          Loading file details...
        </div>
      </DashboardLayout>
    );
  }

  if (!file) {
    return (
      <DashboardLayout title="File Not Found">
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-12 h-12 mx-auto mb-4 text-[var(--foreground-muted)]" />
            <p>File not found</p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const report = file.trustReport;
  const decision = report?.context_decision?.decision || "PENDING";
  const score = report?.reality_confidence?.score ?? 0;
  const grade = report?.reality_confidence?.grade || "?";
  const humanOrigin = report?.human_origin_proof?.value || "UNAVAILABLE";

  const getDecisionColor = (d: string) => {
    switch (d) {
      case "ALLOW": return "bg-emerald-500";
      case "WARN": return "bg-yellow-500";
      case "REQUIRE_EXTRA_VERIFICATION": return "bg-blue-500";
      case "BLOCK": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  return (
    <DashboardLayout
      title={file.filename}
      description={`${formatBytes(file.size)} · ${file.workflow}`}
    >
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Human Origin */}
          <Card className={humanOrigin === "YES" ? "border-emerald-500/50" : humanOrigin === "NO" ? "border-red-500/50" : ""}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                  humanOrigin === "YES" ? "bg-emerald-500/20" : humanOrigin === "NO" ? "bg-red-500/20" : "bg-gray-500/20"
                }`}>
                  <User className={`w-8 h-8 ${
                    humanOrigin === "YES" ? "text-emerald-500" : humanOrigin === "NO" ? "text-red-500" : "text-gray-500"
                  }`} />
                </div>
                <div>
                  <p className="text-sm text-[var(--foreground-muted)]">Human-Origin Proof</p>
                  <p className={`text-3xl font-bold ${
                    humanOrigin === "YES" ? "text-emerald-500" : humanOrigin === "NO" ? "text-red-500" : "text-gray-500"
                  }`}>
                    {humanOrigin}
                  </p>
                  <p className="text-xs text-[var(--foreground-muted)] mt-1">
                    {report?.human_origin_proof?.reason || "No data"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Confidence Score */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center border-4 ${getGradeColor(grade)}`} style={{ borderColor: "currentColor" }}>
                  <span className={`text-2xl font-bold ${getGradeColor(grade)}`}>{grade}</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-[var(--foreground-muted)]">Reality Confidence</p>
                  <p className="text-3xl font-bold">{score}<span className="text-lg">/100</span></p>
                  <Progress value={score} className="mt-2" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Context Decision */}
          <Card className={`border-l-4 ${getDecisionColor(decision).replace("bg-", "border-")}`}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${getDecisionColor(decision)}/20`}>
                  <Shield className={`w-8 h-8 ${getDecisionColor(decision).replace("bg-", "text-")}`} />
                </div>
                <div>
                  <p className="text-sm text-[var(--foreground-muted)]">Context Decision</p>
                  <p className={`text-2xl font-bold ${getDecisionColor(decision).replace("bg-", "text-")}`}>
                    {decision}
                  </p>
                  <p className="text-xs text-[var(--foreground-muted)] mt-1">
                    {report?.context_decision?.workflow || file.workflow}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabbed Details */}
        <Tabs defaultValue="summary" className="space-y-4">
          <TabsList>
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="provenance">Provenance</TabsTrigger>
            <TabsTrigger value="confidence">Confidence</TabsTrigger>
            <TabsTrigger value="context">Context</TabsTrigger>
            <TabsTrigger value="proofs">Proofs</TabsTrigger>
          </TabsList>

          {/* Summary Tab */}
          <TabsContent value="summary">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* File Metadata */}
              <Card>
                <CardHeader>
                  <CardTitle>File Metadata</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-[var(--foreground-muted)]">Filename</span>
                    <span className="font-mono">{file.filename}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-[var(--foreground-muted)]">MIME Type</span>
                    <span>{file.mime}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-[var(--foreground-muted)]">Size</span>
                    <span>{formatBytes(file.size)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-[var(--foreground-muted)]">SHA-256</span>
                    <span className="font-mono text-xs">{truncateHash(file.sha256, 16)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-[var(--foreground-muted)]">Uploaded</span>
                    <span>{formatDate(file.uploadedAt)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-[var(--foreground-muted)]">Workflow</span>
                    <Badge variant="outline">{file.workflow}</Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Integrity Checklist */}
              <Card>
                <CardHeader>
                  <CardTitle>Integrity Checklist</CardTitle>
                </CardHeader>
                <CardContent>
                  {report?.integrity ? (
                    <div className="space-y-1">
                      <IntegrityCheck label="Payload Hash Match" passed={report.integrity.payload_hash_ok} />
                      <IntegrityCheck label="Manifest Signature" passed={report.integrity.manifest_signature_ok} />
                      <IntegrityCheck label="Event Chain Valid" passed={report.integrity.event_chain_ok} />
                      <IntegrityCheck label="Transparency Log" passed={report.integrity.transparency_log_ok} />
                    </div>
                  ) : (
                    <p className="text-[var(--foreground-muted)]">No integrity data available</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Provenance Tab */}
          <TabsContent value="provenance">
            <Card>
              <CardHeader>
                <CardTitle>Chain of Custody</CardTitle>
                <CardDescription>
                  Ordered events documenting content provenance. AI interaction breaks human-origin proof.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {file.provenanceEvents.length === 0 ? (
                  <p className="text-[var(--foreground-muted)]">No provenance events recorded</p>
                ) : (
                  <div className="space-y-4">
                    {file.provenanceEvents.map((event, idx) => (
                      <div key={idx} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            event.eventType === "AI_EDIT" ? "bg-red-500/20 text-red-500" :
                            event.eventType === "CAPTURE" ? "bg-emerald-500/20 text-emerald-500" :
                            "bg-blue-500/20 text-blue-500"
                          }`}>
                            {event.eventType === "CAPTURE" ? <User className="w-5 h-5" /> :
                             event.eventType === "AI_EDIT" ? <AlertTriangle className="w-5 h-5" /> :
                             <Key className="w-5 h-5" />}
                          </div>
                          {idx < file.provenanceEvents.length - 1 && (
                            <div className="w-0.5 h-full bg-[var(--border)] my-2" />
                          )}
                        </div>
                        <div className="flex-1 pb-4">
                          <div className="flex items-center gap-2">
                            <Badge variant={event.eventType === "AI_EDIT" ? "destructive" : "outline"}>
                              {event.eventType}
                            </Badge>
                            {event.valid ? (
                              <Badge variant="success" className="text-xs">Valid</Badge>
                            ) : (
                              <Badge variant="destructive" className="text-xs">Invalid</Badge>
                            )}
                          </div>
                          <p className="text-sm text-[var(--foreground-muted)] mt-1">
                            {formatDate(event.eventTime)}
                          </p>
                          <div className="mt-2 p-3 rounded bg-[var(--background-secondary)] text-xs font-mono">
                            <p>Actor: {event.actorKeyId}</p>
                            <p>Hash: {truncateHash(event.eventHash, 16)}</p>
                            {event.prevEventHash && (
                              <p>Prev: {truncateHash(event.prevEventHash, 16)}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Confidence Tab */}
          <TabsContent value="confidence">
            <Card>
              <CardHeader>
                <CardTitle>Score Breakdown</CardTitle>
                <CardDescription>
                  Deterministic signals that contribute to the confidence score
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {file.signals.map((signal, idx) => (
                    <div key={idx} className="p-4 rounded-lg bg-[var(--background-secondary)]">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{signal.name.replace(/_/g, " ")}</span>
                          <Badge variant={
                            signal.severity === "CRITICAL" ? "destructive" :
                            signal.severity === "HIGH" ? "warn" :
                            "secondary"
                          } className="text-xs">
                            {signal.severity}
                          </Badge>
                        </div>
                        <span className={`font-bold ${signal.delta >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                          {signal.delta >= 0 ? "+" : ""}{signal.delta}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--foreground-muted)]">{signal.explanation}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-6 p-4 rounded-lg border border-[var(--border)]">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-medium">Total Score</span>
                    <span className={`text-2xl font-bold ${getGradeColor(grade)}`}>
                      {score} ({grade})
                    </span>
                  </div>
                  {report?.reality_confidence?.limitations && (
                    <p className="text-sm text-[var(--foreground-muted)] mt-2">
                      {report.reality_confidence.limitations}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Context Tab */}
          <TabsContent value="context">
            <Card>
              <CardHeader>
                <CardTitle>Policy Evaluation</CardTitle>
                <CardDescription>
                  How the workflow policy determined the decision
                </CardDescription>
              </CardHeader>
              <CardContent>
                {file.policyDecision ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-[var(--foreground-muted)]">Workflow</p>
                        <p className="font-medium">{file.policyDecision.workflowName || file.workflow}</p>
                      </div>
                      <div>
                        <p className="text-sm text-[var(--foreground-muted)]">Policy Version</p>
                        <p className="font-medium">{file.policyDecision.policyVersion || "1.0.0"}</p>
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <p className="text-sm text-[var(--foreground-muted)] mb-2">Decision</p>
                      <Badge variant={
                        decision === "ALLOW" ? "allow" :
                        decision === "WARN" ? "warn" :
                        decision === "BLOCK" ? "block" :
                        "require"
                      } className="text-lg px-4 py-1">
                        {decision}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-[var(--foreground-muted)] mb-2">Rationale</p>
                      <p>{file.policyDecision.rationale}</p>
                    </div>
                    <div>
                      <p className="text-sm text-[var(--foreground-muted)] mb-2">Matched Rules</p>
                      <div className="flex flex-wrap gap-2">
                        {file.policyDecision.matchedRules.map((rule, idx) => (
                          <Badge key={idx} variant="outline">{rule}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-[var(--foreground-muted)]">No policy decision data</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Proofs Tab */}
          <TabsContent value="proofs">
            <Card>
              <CardHeader>
                <CardTitle>External Verifiability</CardTitle>
                <CardDescription>
                  Transparency log proof and verification bundle for third-party verification
                </CardDescription>
              </CardHeader>
              <CardContent>
                {file.transparencyProof ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-[var(--foreground-muted)]">Leaf Index</p>
                        <p className="font-mono">{file.transparencyProof.leafIndex}</p>
                      </div>
                      <div>
                        <p className="text-sm text-[var(--foreground-muted)]">Tree Size</p>
                        <p className="font-mono">{file.transparencyProof.treeSize}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-[var(--foreground-muted)] mb-1">Leaf Hash</p>
                      <p className="font-mono text-xs break-all bg-[var(--background-secondary)] p-2 rounded">
                        {file.transparencyProof.leafHash}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-[var(--foreground-muted)] mb-1">Root Hash</p>
                      <p className="font-mono text-xs break-all bg-[var(--background-secondary)] p-2 rounded">
                        {file.transparencyProof.rootHash}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-[var(--foreground-muted)] mb-1">Merkle Proof ({file.transparencyProof.proof.length} nodes)</p>
                      <div className="space-y-1">
                        {file.transparencyProof.proof.map((hash, idx) => (
                          <p key={idx} className="font-mono text-xs break-all bg-[var(--background-secondary)] p-2 rounded">
                            [{idx}] {truncateHash(hash, 24)}
                          </p>
                        ))}
                      </div>
                    </div>
                    <Separator />
                    <Button onClick={exportBundle} className="w-full">
                      <Download className="w-4 h-4 mr-2" />
                      Export Verification Bundle
                    </Button>
                    <div className="p-4 rounded-lg bg-[var(--background-secondary)]">
                      <p className="text-sm font-medium mb-2">Verify Offline Instructions</p>
                      <ol className="text-sm text-[var(--foreground-muted)] space-y-1 list-decimal list-inside">
                        <li>Compute SHA-256 of your file</li>
                        <li>Compare with bundle sha256</li>
                        <li>Verify Merkle inclusion proof against checkpoint</li>
                        <li>Verify checkpoint signature with log public key</li>
                      </ol>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <LinkIcon className="w-12 h-12 mx-auto mb-4 text-[var(--foreground-muted)] opacity-50" />
                    <p className="text-[var(--foreground-muted)]">No transparency log proof available</p>
                    <p className="text-sm text-[var(--foreground-muted)]">
                      This file was not published to the transparency log
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
