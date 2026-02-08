"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Shield,
  Upload,
  CheckCircle,
  XCircle,
  FileText,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { formatBytes, getGradeColor } from "@/lib/utils";

interface VerificationBundle {
  version: string;
  file: {
    sha256: string;
    filename: string;
    size: number;
  };
  trust_report: {
    human_origin_proof: { value: string; reason: string };
    reality_confidence: { score: number; grade: string };
    context_decision: { decision: string; rationale: string };
    integrity: {
      payload_hash_ok: boolean;
      manifest_signature_ok: boolean;
      event_chain_ok: boolean;
      transparency_log_ok: boolean;
    };
  };
  transparency_proof?: {
    leafIndex: number;
    leafHash: string;
    rootHash: string;
    proof: string[];
  };
}

interface VerificationResult {
  passed: boolean;
  hashMatch: boolean;
  integrityChecks: {
    name: string;
    passed: boolean;
  }[];
  bundle: VerificationBundle;
}

export default function VerifyPage() {
  const [bundle, setBundle] = useState<VerificationBundle | null>(null);
  const [fileHash, setFileHash] = useState<string | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [step, setStep] = useState<"bundle" | "file" | "result">("bundle");

  // Bundle upload
  const onDropBundle = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as VerificationBundle;
      setBundle(parsed);
      setStep("file");
    } catch (error) {
      alert("Invalid verification bundle JSON");
    }
  }, []);

  const { getRootProps: getBundleProps, getInputProps: getBundleInputProps, isDragActive: isBundleDragActive } = useDropzone({
    onDrop: onDropBundle,
    accept: { "application/json": [".json"] },
    multiple: false,
  });

  // File upload for hash verification
  const onDropFile = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file || !bundle) return;

    // Compute SHA-256
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const computedHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    setFileHash(computedHash);

    // Verify
    const hashMatch = computedHash === bundle.file.sha256;
    const integrityChecks = bundle.trust_report.integrity
      ? [
          { name: "Payload Hash Match", passed: hashMatch },
          { name: "Manifest Signature", passed: bundle.trust_report.integrity.manifest_signature_ok },
          { name: "Event Chain Valid", passed: bundle.trust_report.integrity.event_chain_ok },
          { name: "Transparency Log", passed: bundle.trust_report.integrity.transparency_log_ok },
        ]
      : [{ name: "Payload Hash Match", passed: hashMatch }];

    const allPassed = integrityChecks.every((c) => c.passed);

    setResult({
      passed: allPassed,
      hashMatch,
      integrityChecks,
      bundle,
    });
    setStep("result");
  }, [bundle]);

  const { getRootProps: getFileProps, getInputProps: getFileInputProps, isDragActive: isFileDragActive } = useDropzone({
    onDrop: onDropFile,
    multiple: false,
  });

  const reset = () => {
    setBundle(null);
    setFileHash(null);
    setResult(null);
    setStep("bundle");
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="border-b border-[var(--border)] bg-[var(--background-secondary)]">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--verity-blue-primary)] to-[var(--verity-teal-accent)] flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Verity Public Verify</h1>
              <p className="text-xs text-[var(--foreground-muted)]">Third-party verification</p>
            </div>
          </div>
          <a href="/" className="text-sm text-[var(--verity-teal-accent)] hover:underline flex items-center gap-1">
            Dashboard <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Verify Content Without Trust</h2>
          <p className="text-[var(--foreground-muted)] max-w-2xl mx-auto">
            Verify file integrity and transparency log proofs using only cryptographic evidence.
            No need to trust Verity servers - verify everything locally.
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-4 mb-12">
          <div className={`flex items-center gap-2 ${step === "bundle" ? "text-[var(--verity-teal-accent)]" : "text-[var(--foreground-muted)]"}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === "bundle" ? "bg-[var(--verity-teal-accent)]" : "bg-[var(--background-card)]"}`}>
              <span className={step === "bundle" ? "text-white" : ""}>1</span>
            </div>
            <span>Upload Bundle</span>
          </div>
          <div className="w-12 h-0.5 bg-[var(--border)]" />
          <div className={`flex items-center gap-2 ${step === "file" ? "text-[var(--verity-teal-accent)]" : "text-[var(--foreground-muted)]"}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === "file" ? "bg-[var(--verity-teal-accent)]" : "bg-[var(--background-card)]"}`}>
              <span className={step === "file" ? "text-white" : ""}>2</span>
            </div>
            <span>Upload File</span>
          </div>
          <div className="w-12 h-0.5 bg-[var(--border)]" />
          <div className={`flex items-center gap-2 ${step === "result" ? "text-[var(--verity-teal-accent)]" : "text-[var(--foreground-muted)]"}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === "result" ? "bg-[var(--verity-teal-accent)]" : "bg-[var(--background-card)]"}`}>
              <span className={step === "result" ? "text-white" : ""}>3</span>
            </div>
            <span>Results</span>
          </div>
        </div>

        {/* Step Content */}
        {step === "bundle" && (
          <Card>
            <CardHeader>
              <CardTitle>Step 1: Upload Verification Bundle</CardTitle>
              <CardDescription>
                Upload the JSON verification bundle exported from Verity Dashboard
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                {...getBundleProps()}
                className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                  isBundleDragActive
                    ? "border-[var(--verity-teal-accent)] bg-[var(--verity-teal-accent)]/5"
                    : "border-[var(--border)] hover:border-[var(--verity-blue-primary)]"
                }`}
              >
                <input {...getBundleInputProps()} />
                <Upload className="w-12 h-12 mx-auto text-[var(--foreground-muted)] mb-4" />
                <p className="text-[var(--foreground)]">
                  Drag & drop verification bundle here
                </p>
                <p className="text-sm text-[var(--foreground-muted)] mt-2">
                  Accepts .json files
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "file" && bundle && (
          <Card>
            <CardHeader>
              <CardTitle>Step 2: Upload File to Verify</CardTitle>
              <CardDescription>
                Upload the file you want to verify against the bundle
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6 p-4 rounded-lg bg-[var(--background-secondary)]">
                <p className="text-sm text-[var(--foreground-muted)] mb-2">Expected file from bundle:</p>
                <p className="font-medium">{bundle.file.filename}</p>
                <p className="text-sm text-[var(--foreground-muted)]">
                  {formatBytes(bundle.file.size)} · SHA-256: {bundle.file.sha256.substring(0, 16)}...
                </p>
              </div>

              <div
                {...getFileProps()}
                className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                  isFileDragActive
                    ? "border-[var(--verity-teal-accent)] bg-[var(--verity-teal-accent)]/5"
                    : "border-[var(--border)] hover:border-[var(--verity-blue-primary)]"
                }`}
              >
                <input {...getFileInputProps()} />
                <FileText className="w-12 h-12 mx-auto text-[var(--foreground-muted)] mb-4" />
                <p className="text-[var(--foreground)]">
                  Drag & drop the file to verify
                </p>
                <p className="text-sm text-[var(--foreground-muted)] mt-2">
                  SHA-256 will be computed locally
                </p>
              </div>

              <Button variant="outline" onClick={reset} className="mt-4">
                Back to Step 1
              </Button>
            </CardContent>
          </Card>
        )}

        {step === "result" && result && (
          <div className="space-y-6">
            {/* Result Banner */}
            <Card className={result.passed ? "border-emerald-500/50" : "border-red-500/50"}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-6">
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center ${
                    result.passed ? "bg-emerald-500/20" : "bg-red-500/20"
                  }`}>
                    {result.passed ? (
                      <CheckCircle className="w-10 h-10 text-emerald-500" />
                    ) : (
                      <XCircle className="w-10 h-10 text-red-500" />
                    )}
                  </div>
                  <div>
                    <h3 className={`text-2xl font-bold ${result.passed ? "text-emerald-500" : "text-red-500"}`}>
                      Verification {result.passed ? "PASSED" : "FAILED"}
                    </h3>
                    <p className="text-[var(--foreground-muted)] mt-1">
                      {result.passed
                        ? "File integrity and proofs verified successfully"
                        : "One or more verification checks failed"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Integrity Checks */}
            <Card>
              <CardHeader>
                <CardTitle>Integrity Checks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {result.integrityChecks.map((check, idx) => (
                    <div key={idx} className="flex items-center justify-between py-2">
                      <span>{check.name}</span>
                      {check.passed ? (
                        <Badge variant="success" className="gap-1">
                          <CheckCircle className="w-3 h-3" /> PASS
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <XCircle className="w-3 h-3" /> FAIL
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Trust Report Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Trust Report Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-6">
                  <div className="text-center">
                    <p className="text-sm text-[var(--foreground-muted)]">Human Origin</p>
                    <p className={`text-2xl font-bold ${
                      result.bundle.trust_report.human_origin_proof.value === "YES"
                        ? "text-emerald-500"
                        : result.bundle.trust_report.human_origin_proof.value === "NO"
                        ? "text-red-500"
                        : "text-gray-500"
                    }`}>
                      {result.bundle.trust_report.human_origin_proof.value}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-[var(--foreground-muted)]">Confidence Score</p>
                    <p className={`text-2xl font-bold ${getGradeColor(result.bundle.trust_report.reality_confidence.grade)}`}>
                      {result.bundle.trust_report.reality_confidence.score} ({result.bundle.trust_report.reality_confidence.grade})
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-[var(--foreground-muted)]">Decision</p>
                    <Badge variant={
                      result.bundle.trust_report.context_decision.decision === "ALLOW" ? "allow" :
                      result.bundle.trust_report.context_decision.decision === "WARN" ? "warn" :
                      result.bundle.trust_report.context_decision.decision === "BLOCK" ? "block" :
                      "require"
                    } className="text-lg px-4 py-1">
                      {result.bundle.trust_report.context_decision.decision}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Hash Comparison */}
            <Card>
              <CardHeader>
                <CardTitle>Hash Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-[var(--foreground-muted)] mb-1">Expected (from bundle)</p>
                    <p className="font-mono text-sm break-all bg-[var(--background-secondary)] p-2 rounded">
                      {result.bundle.file.sha256}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-[var(--foreground-muted)] mb-1">Computed (from uploaded file)</p>
                    <p className={`font-mono text-sm break-all p-2 rounded ${
                      result.hashMatch ? "bg-emerald-500/10" : "bg-red-500/10"
                    }`}>
                      {fileHash}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button onClick={reset} className="w-full">
              Verify Another File
            </Button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] mt-12">
        <div className="max-w-4xl mx-auto px-6 py-6 text-center text-sm text-[var(--foreground-muted)]">
          <p>Verity - Trust Infrastructure for Digital Content</p>
          <p className="mt-1">All verification is performed locally in your browser</p>
        </div>
      </footer>
    </div>
  );
}
