"use client";

import { useEffect, useState, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bot,
  Play,
  FileText,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  XCircle,
  Info,
  Loader2,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Report {
  id: string;
  reportType: string;
  severity: string;
  title: string;
  summary: string;
  detailsJson: string;
  eventCount: number;
  periodStart: string;
  periodEnd: string;
  generatedBy: string;
  createdAt: string;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [severityFilter, setSeverityFilter] = useState("");
  const [expandedReport, setExpandedReport] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      if (severityFilter) params.set("severity", severityFilter);

      const res = await fetch(`/api/agent/reports?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setReports(data.reports);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [page, severityFilter]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const runAgent = async () => {
    setRunning(true);
    try {
      const res = await fetch("/api/agent/run", { method: "POST" });
      if (res.ok) {
        fetchReports();
      }
    } catch (err) {
      console.error("Failed to run agent:", err);
    } finally {
      setRunning(false);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return <XCircle className="w-4 h-4 text-red-500" />;
      case "WARNING":
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return <Badge variant="destructive">CRITICAL</Badge>;
      case "WARNING":
        return <Badge variant="warn">WARNING</Badge>;
      default:
        return <Badge variant="secondary">INFO</Badge>;
    }
  };

  const parseDetails = (json: string) => {
    try {
      return JSON.parse(json);
    } catch {
      return null;
    }
  };

  return (
    <DashboardLayout
      title="Agent Reports"
      description="Oversight agent digests and analysis reports"
    >
      <div className="space-y-6">
        {/* Actions bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-[var(--foreground-muted)]">
            <Bot className="w-4 h-4 text-[var(--verity-teal-accent)]" />
            <span>Heuristic analysis engine</span>
          </div>
          <Button onClick={runAgent} disabled={running}>
            {running ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            {running ? "Running..." : "Run Agent Now"}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="verity-heading">Report History</CardTitle>
              <Select
                value={severityFilter || "all"}
                onValueChange={(v) => setSeverityFilter(v === "all" ? "" : v)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                  <SelectItem value="WARNING">Warning</SelectItem>
                  <SelectItem value="INFO">Info</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-20 rounded-lg bg-[var(--background-secondary)] animate-pulse" />
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <XCircle className="w-12 h-12 mx-auto mb-2 text-red-500 opacity-50" />
                <p className="text-[var(--foreground-muted)]">Failed to load reports</p>
                <Button variant="outline" className="mt-4" onClick={fetchReports}>
                  Retry
                </Button>
              </div>
            ) : reports.length === 0 ? (
              <div className="text-center py-12 text-[var(--foreground-muted)]">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="font-medium">No reports yet</p>
                <p className="text-sm mb-4">Run the oversight agent to generate the first digest</p>
                <Button onClick={runAgent} disabled={running}>
                  <Play className="w-4 h-4 mr-2" />
                  Generate Report
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {reports.map((report) => {
                    const isExpanded = expandedReport === report.id;
                    const details = isExpanded ? parseDetails(report.detailsJson) : null;

                    return (
                      <div
                        key={report.id}
                        className="rounded-lg border border-[var(--border)] bg-[var(--background-secondary)]"
                      >
                        <button
                          onClick={() => setExpandedReport(isExpanded ? null : report.id)}
                          className="w-full p-4 text-left"
                        >
                          <div className="flex items-start gap-4">
                            <div className="mt-0.5">{getSeverityIcon(report.severity)}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                {getSeverityBadge(report.severity)}
                                <Badge variant="outline">{report.reportType}</Badge>
                                <span className="text-xs text-[var(--foreground-muted)]">
                                  {report.eventCount} events analyzed
                                </span>
                              </div>
                              <p className="font-medium text-[var(--foreground)]">
                                {report.title}
                              </p>
                              <p className="text-sm text-[var(--foreground-muted)] mt-1 line-clamp-2">
                                {report.summary}
                              </p>
                              <div className="flex items-center gap-3 mt-2 text-xs text-[var(--foreground-muted)]">
                                <span>{formatDate(report.createdAt)}</span>
                                <span>via {report.generatedBy}</span>
                              </div>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5 text-[var(--foreground-muted)] shrink-0" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-[var(--foreground-muted)] shrink-0" />
                            )}
                          </div>
                        </button>

                        {isExpanded && details && (
                          <div className="border-t border-[var(--border)] p-4 space-y-4">
                            {/* Metrics */}
                            {details.metrics && (
                              <div>
                                <h4 className="text-sm font-medium mb-2">Metrics</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                  <div className="p-3 rounded bg-[var(--background-card)]">
                                    <p className="text-xs text-[var(--foreground-muted)]">Total Files</p>
                                    <p className="text-lg font-bold">{details.metrics.totalFiles}</p>
                                  </div>
                                  <div className="p-3 rounded bg-[var(--background-card)]">
                                    <p className="text-xs text-[var(--foreground-muted)]">New Files</p>
                                    <p className="text-lg font-bold">{details.metrics.newFiles}</p>
                                  </div>
                                  <div className="p-3 rounded bg-[var(--background-card)]">
                                    <p className="text-xs text-[var(--foreground-muted)]">Avg Confidence</p>
                                    <p className="text-lg font-bold">{details.metrics.avgConfidence}%</p>
                                  </div>
                                  <div className="p-3 rounded bg-[var(--background-card)]">
                                    <p className="text-xs text-[var(--foreground-muted)]">Blocked</p>
                                    <p className="text-lg font-bold text-red-500">
                                      {details.metrics.decisions?.BLOCK ?? 0}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Decisions breakdown */}
                            {details.metrics?.decisions && (
                              <div>
                                <h4 className="text-sm font-medium mb-2">Decisions</h4>
                                <div className="flex gap-2 flex-wrap">
                                  <Badge variant="allow">ALLOW: {details.metrics.decisions.ALLOW}</Badge>
                                  <Badge variant="warn">WARN: {details.metrics.decisions.WARN}</Badge>
                                  <Badge variant="require">REQUIRE: {details.metrics.decisions.REQUIRE_EXTRA_VERIFICATION}</Badge>
                                  <Badge variant="block">BLOCK: {details.metrics.decisions.BLOCK}</Badge>
                                </div>
                              </div>
                            )}

                            {/* Alerts from this report */}
                            {details.analysis?.alerts && details.analysis.alerts.length > 0 && (
                              <div>
                                <h4 className="text-sm font-medium mb-2">
                                  Alerts ({details.analysis.alerts.length})
                                </h4>
                                <div className="space-y-2">
                                  {details.analysis.alerts.map((alert: { alertType: string; severity: string; title: string; message: string }, i: number) => (
                                    <div
                                      key={i}
                                      className={`p-3 rounded text-sm ${
                                        alert.severity === "CRITICAL"
                                          ? "bg-red-500/10 border border-red-500/20"
                                          : "bg-yellow-500/10 border border-yellow-500/20"
                                      }`}
                                    >
                                      <p className="font-medium">{alert.title}</p>
                                      <p className="text-[var(--foreground-muted)] mt-1">{alert.message}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Recommendations */}
                            {details.analysis?.recommendations && details.analysis.recommendations.length > 0 && (
                              <div>
                                <h4 className="text-sm font-medium mb-2">Recommendations</h4>
                                <ul className="space-y-1 text-sm text-[var(--foreground-muted)]">
                                  {details.analysis.recommendations.map((rec: string, i: number) => (
                                    <li key={i} className="flex items-start gap-2">
                                      <span className="text-[var(--verity-teal-accent)]">-</span>
                                      {rec}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-6">
                  <p className="text-sm text-[var(--foreground-muted)]">
                    Page {page} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
