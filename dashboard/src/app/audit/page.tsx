"use client";

import { useEffect, useState } from "react";
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
  FileText,
  Download,
  ChevronLeft,
  ChevronRight,
  Upload,
  CheckCircle,
  Shield,
  Settings,
  User,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actor: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");

  useEffect(() => {
    async function fetchLogs() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        if (actionFilter) params.set("action", actionFilter);
        if (entityFilter) params.set("entityType", entityFilter);

        const res = await fetch(`/api/audit?${params}`);
        if (res.ok) {
          const data = await res.json();
          setLogs(data.logs);
          setTotalPages(data.totalPages);
        }
      } catch (error) {
        console.error("Failed to fetch audit logs:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchLogs();
  }, [page, actionFilter, entityFilter]);

  const exportLogs = () => {
    const csv = [
      ["Timestamp", "Action", "Entity Type", "Entity ID", "Actor", "Details"].join(","),
      ...logs.map((log) =>
        [
          log.createdAt,
          log.action,
          log.entityType,
          log.entityId || "",
          log.actor,
          JSON.stringify(log.details).replace(/"/g, '""'),
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "INTAKE":
        return <Upload className="w-4 h-4" />;
      case "VERIFY":
        return <CheckCircle className="w-4 h-4" />;
      case "DECISION":
        return <Shield className="w-4 h-4" />;
      case "POLICY_CHANGE":
        return <Settings className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "INTAKE":
        return "bg-blue-500/20 text-blue-500";
      case "VERIFY":
        return "bg-emerald-500/20 text-emerald-500";
      case "DECISION":
        return "bg-purple-500/20 text-purple-500";
      case "POLICY_CHANGE":
        return "bg-yellow-500/20 text-yellow-500";
      default:
        return "bg-gray-500/20 text-gray-500";
    }
  };

  return (
    <DashboardLayout
      title="Audit Log"
      description="Append-only record of all system events"
    >
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="verity-heading">Event Log</CardTitle>
            <div className="flex gap-3">
              <Select value={actionFilter || "all"} onValueChange={(v) => setActionFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="INTAKE">INTAKE</SelectItem>
                  <SelectItem value="VERIFY">VERIFY</SelectItem>
                  <SelectItem value="DECISION">DECISION</SelectItem>
                  <SelectItem value="POLICY_CHANGE">POLICY_CHANGE</SelectItem>
                  <SelectItem value="EXPORT">EXPORT</SelectItem>
                </SelectContent>
              </Select>

              <Select value={entityFilter || "all"} onValueChange={(v) => setEntityFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Entity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Entities</SelectItem>
                  <SelectItem value="FILE">FILE</SelectItem>
                  <SelectItem value="POLICY">POLICY</SelectItem>
                  <SelectItem value="USER">USER</SelectItem>
                  <SelectItem value="SYSTEM">SYSTEM</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" onClick={exportLogs}>
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-[var(--foreground-muted)]">
              Loading audit logs...
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-[var(--foreground-muted)]">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No audit events found</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-4 p-4 rounded-lg bg-[var(--background-secondary)]"
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getActionColor(log.action)}`}>
                      {getActionIcon(log.action)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline">{log.action}</Badge>
                        <Badge variant="secondary">{log.entityType}</Badge>
                        <span className="text-sm text-[var(--foreground-muted)]">
                          by {log.actor}
                        </span>
                      </div>
                      {log.entityId && (
                        <p className="text-sm mt-1">
                          Entity: <code className="text-xs bg-[var(--background-card)] px-1 py-0.5 rounded">{log.entityId}</code>
                        </p>
                      )}
                      {Object.keys(log.details).length > 0 && (
                        <p className="text-sm text-[var(--foreground-muted)] mt-1 truncate">
                          {JSON.stringify(log.details)}
                        </p>
                      )}
                    </div>
                    <span className="text-sm text-[var(--foreground-muted)] whitespace-nowrap">
                      {formatDate(log.createdAt)}
                    </span>
                  </div>
                ))}
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
