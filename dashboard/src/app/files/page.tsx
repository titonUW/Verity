"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  FileText,
  ExternalLink,
} from "lucide-react";
import { formatDate, formatBytes, getGradeColor, truncateHash } from "@/lib/utils";
import { WORKFLOWS } from "@/lib/types";

interface FileRow {
  id: string;
  filename: string;
  mime: string;
  size: number;
  sha256: string;
  uploadedAt: string;
  workflow: string;
  status: string;
  humanOrigin: string;
  score: number | null;
  grade: string | null;
  decision: string | null;
  integrityOk: boolean | null;
}

export default function FilesPage() {
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    workflow: "",
    decision: "",
    status: "",
    search: "",
  });

  useEffect(() => {
    async function fetchFiles() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        if (filters.workflow) params.set("workflow", filters.workflow);
        if (filters.decision) params.set("decision", filters.decision);
        if (filters.status) params.set("status", filters.status);

        const res = await fetch(`/api/files?${params}`);
        if (res.ok) {
          const data = await res.json();
          setFiles(data.files);
          setTotalPages(data.totalPages);
        }
      } catch (error) {
        console.error("Failed to fetch files:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchFiles();
  }, [page, filters]);

  const getDecisionBadge = (decision: string | null) => {
    if (!decision) return <Badge variant="secondary">Pending</Badge>;
    switch (decision) {
      case "ALLOW":
        return <Badge variant="allow">ALLOW</Badge>;
      case "WARN":
        return <Badge variant="warn">WARN</Badge>;
      case "REQUIRE_EXTRA_VERIFICATION":
        return <Badge variant="require">REQUIRE</Badge>;
      case "BLOCK":
        return <Badge variant="block">BLOCK</Badge>;
      default:
        return <Badge variant="secondary">{decision}</Badge>;
    }
  };

  const getHumanOriginBadge = (value: string) => {
    switch (value) {
      case "YES":
        return <Badge variant="success">YES</Badge>;
      case "NO":
        return <Badge variant="destructive">NO</Badge>;
      default:
        return <Badge variant="secondary">N/A</Badge>;
    }
  };

  const filteredFiles = files.filter((f) =>
    filters.search
      ? f.filename.toLowerCase().includes(filters.search.toLowerCase()) ||
        f.sha256.includes(filters.search.toLowerCase())
      : true
  );

  return (
    <DashboardLayout
      title="Files"
      description="View and manage verified files"
    >
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="verity-heading">All Files</CardTitle>
            <div className="flex flex-wrap gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--foreground-muted)]" />
                <Input
                  placeholder="Search files..."
                  className="pl-9 w-48"
                  value={filters.search}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, search: e.target.value }))
                  }
                />
              </div>

              {/* Workflow Filter */}
              <Select
                value={filters.workflow || "all"}
                onValueChange={(v) => setFilters((f) => ({ ...f, workflow: v === "all" ? "" : v }))}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Workflow" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Workflows</SelectItem>
                  {WORKFLOWS.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Decision Filter */}
              <Select
                value={filters.decision || "all"}
                onValueChange={(v) => setFilters((f) => ({ ...f, decision: v === "all" ? "" : v }))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Decision" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="ALLOW">ALLOW</SelectItem>
                  <SelectItem value="WARN">WARN</SelectItem>
                  <SelectItem value="REQUIRE_EXTRA_VERIFICATION">REQUIRE</SelectItem>
                  <SelectItem value="BLOCK">BLOCK</SelectItem>
                </SelectContent>
              </Select>

              {/* Status Filter */}
              <Select
                value={filters.status || "all"}
                onValueChange={(v) => setFilters((f) => ({ ...f, status: v === "all" ? "" : v }))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="QUEUED">Queued</SelectItem>
                  <SelectItem value="PROCESSING">Processing</SelectItem>
                  <SelectItem value="VERIFIED">Verified</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-[var(--foreground-muted)]">
              Loading files...
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="text-center py-12 text-[var(--foreground-muted)]">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No files found</p>
              <p className="text-sm">Upload files via the Intake page</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th>Filename</th>
                      <th>Workflow</th>
                      <th>Human Origin</th>
                      <th>Score</th>
                      <th>Decision</th>
                      <th>Uploaded</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFiles.map((file) => (
                      <tr key={file.id}>
                        <td>
                          <div>
                            <p className="font-medium">{file.filename}</p>
                            <p className="text-xs text-[var(--foreground-muted)]">
                              {formatBytes(file.size)} · {truncateHash(file.sha256, 8)}
                            </p>
                          </div>
                        </td>
                        <td>
                          <Badge variant="outline">{file.workflow}</Badge>
                        </td>
                        <td>{getHumanOriginBadge(file.humanOrigin)}</td>
                        <td>
                          {file.score !== null ? (
                            <span className={getGradeColor(file.grade || "F")}>
                              {file.score} ({file.grade})
                            </span>
                          ) : (
                            <span className="text-[var(--foreground-muted)]">-</span>
                          )}
                        </td>
                        <td>{getDecisionBadge(file.decision)}</td>
                        <td className="text-sm text-[var(--foreground-muted)]">
                          {formatDate(file.uploadedAt)}
                        </td>
                        <td>
                          <Link href={`/files/${file.id}`}>
                            <Button variant="ghost" size="sm">
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-[var(--foreground-muted)]">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
