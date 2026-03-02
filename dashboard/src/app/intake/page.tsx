"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, File, CheckCircle, Clock, AlertCircle, Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { computeSha256, formatBytes, formatDate } from "@/lib/utils";
import { WORKFLOWS } from "@/lib/types";

interface QueuedFile {
  id: string;
  file: File;
  sha256: string;
  workflow: string;
  status: "queued" | "uploading" | "processing" | "verified" | "failed";
  fileId?: string;
  error?: string;
}

export default function IntakePage() {
  const [workflow, setWorkflow] = useState("vendor-bank-change");
  const [storePayload, setStorePayload] = useState(false);
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      // Add files to queue with computed hashes
      const newItems: QueuedFile[] = [];

      for (const file of acceptedFiles) {
        const sha256 = await computeSha256(file);
        newItems.push({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          file,
          sha256,
          workflow,
          status: "queued",
        });
      }

      setQueue((prev) => [...prev, ...newItems]);
    },
    [workflow]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
  });

  const processQueue = async () => {
    setUploading(true);

    for (const item of queue) {
      if (item.status !== "queued") continue;

      // Update status to uploading
      setQueue((prev) =>
        prev.map((q) =>
          q.id === item.id ? { ...q, status: "uploading" as const } : q
        )
      );

      try {
        // Submit to intake API
        const intakeRes = await fetch("/api/intake", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: item.file.name,
            mime: item.file.type || "application/octet-stream",
            size: item.file.size,
            sha256: item.sha256,
            workflow: item.workflow,
            storePayload,
          }),
        });

        if (!intakeRes.ok) {
          const errorData = await intakeRes.json().catch(() => ({}));
          throw new Error(errorData.error || `Intake failed (HTTP ${intakeRes.status})`);
        }

        const intakeData = await intakeRes.json();
        const fileId = intakeData.id;

        // Update status to processing
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id ? { ...q, status: "processing" as const, fileId } : q
          )
        );

        // Trigger verification
        const verifyRes = await fetch(`/api/verify/${fileId}`, {
          method: "POST",
        });

        if (!verifyRes.ok) {
          const errorData = await verifyRes.json().catch(() => ({}));
          throw new Error(errorData.error || `Verification failed (HTTP ${verifyRes.status})`);
        }

        // Update status to verified
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id ? { ...q, status: "verified" as const } : q
          )
        );
      } catch (error) {
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? { ...q, status: "failed" as const, error: String(error) }
              : q
          )
        );
      }
    }

    setUploading(false);
  };

  const clearCompleted = () => {
    setQueue((prev) => prev.filter((q) => q.status !== "verified"));
  };

  const getStatusBadge = (status: QueuedFile["status"]) => {
    switch (status) {
      case "queued":
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Queued</Badge>;
      case "uploading":
        return <Badge variant="info"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Uploading</Badge>;
      case "processing":
        return <Badge variant="info"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Processing</Badge>;
      case "verified":
        return <Badge variant="success"><CheckCircle className="w-3 h-3 mr-1" />Verified</Badge>;
      case "failed":
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Failed</Badge>;
    }
  };

  return (
    <DashboardLayout
      title="File Intake"
      description="Upload and verify digital content"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Area */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="verity-heading">Upload Files</CardTitle>
            <CardDescription>
              Drag and drop files or click to select. SHA-256 hash is computed client-side before upload.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Workflow Selector */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="space-y-2">
                <Label>Workflow</Label>
                <Select value={workflow} onValueChange={setWorkflow}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WORKFLOWS.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Storage Mode</Label>
                <div className="flex items-center space-x-2 h-10">
                  <Switch
                    id="store-payload"
                    checked={storePayload}
                    onCheckedChange={setStorePayload}
                  />
                  <Label htmlFor="store-payload" className="text-sm text-[var(--foreground-muted)]">
                    {storePayload ? "Store full payload" : "Metadata only (privacy-first)"}
                  </Label>
                </div>
              </div>
            </div>

            {/* Dropzone */}
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? "border-[var(--verity-teal-accent)] bg-[var(--verity-teal-accent)]/5"
                  : "border-[var(--border)] hover:border-[var(--verity-blue-primary)]"
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="w-12 h-12 mx-auto text-[var(--foreground-muted)] mb-4" />
              {isDragActive ? (
                <p className="text-[var(--verity-teal-accent)]">Drop files here...</p>
              ) : (
                <>
                  <p className="text-[var(--foreground)]">
                    Drag & drop files here, or click to select
                  </p>
                  <p className="text-sm text-[var(--foreground-muted)] mt-2">
                    Supports all file types. Hash computed locally for transparency.
                  </p>
                </>
              )}
            </div>

            {/* Action Buttons */}
            {queue.length > 0 && (
              <div className="flex gap-3 mt-6">
                <Button
                  onClick={processQueue}
                  disabled={uploading || queue.every((q) => q.status !== "queued")}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Process Queue"
                  )}
                </Button>
                <Button variant="secondary" onClick={clearCompleted}>
                  Clear Completed
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Queue Status */}
        <Card>
          <CardHeader>
            <CardTitle className="verity-heading">Intake Queue</CardTitle>
            <CardDescription>{queue.length} file(s) in queue</CardDescription>
          </CardHeader>
          <CardContent>
            {queue.length === 0 ? (
              <div className="text-center py-8 text-[var(--foreground-muted)]">
                <File className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No files in queue</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {queue.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{item.file.name}</p>
                        <p className="text-xs text-[var(--foreground-muted)]">
                          {formatBytes(item.file.size)}
                        </p>
                        <p className="text-xs text-[var(--foreground-muted)] font-mono truncate">
                          {item.sha256.substring(0, 16)}...
                        </p>
                      </div>
                      {getStatusBadge(item.status)}
                    </div>
                    {item.fileId && item.status === "verified" && (
                      <a
                        href={`/files/${item.fileId}`}
                        className="text-xs text-[var(--verity-teal-accent)] hover:underline mt-2 block"
                      >
                        View Details →
                      </a>
                    )}
                    {item.error && (
                      <p className="text-xs text-red-500 mt-2">{item.error}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
