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
  Bell,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Shield,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Alert {
  id: string;
  alertType: string;
  severity: string;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  acknowledged: boolean;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  createdAt: string;
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [unacknowledgedCount, setUnacknowledgedCount] = useState(0);
  const [severityFilter, setSeverityFilter] = useState("");
  const [ackFilter, setAckFilter] = useState("");

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      if (severityFilter) params.set("severity", severityFilter);
      if (ackFilter) params.set("acknowledged", ackFilter);

      const res = await fetch(`/api/alerts?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAlerts(data.alerts);
      setTotalPages(data.totalPages);
      setUnacknowledgedCount(data.unacknowledgedCount);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [page, severityFilter, ackFilter]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const acknowledgeAlert = async (alertId: string) => {
    try {
      const res = await fetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertId }),
      });
      if (res.ok) {
        fetchAlerts();
      }
    } catch (err) {
      console.error("Failed to acknowledge alert:", err);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return <XCircle className="w-5 h-5 text-red-500" />;
      case "WARNING":
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      default:
        return <Bell className="w-5 h-5 text-blue-500" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return <Badge variant="destructive">CRITICAL</Badge>;
      case "WARNING":
        return <Badge variant="warn">WARNING</Badge>;
      default:
        return <Badge variant="secondary">{severity}</Badge>;
    }
  };

  return (
    <DashboardLayout
      title="Alerts"
      description="System alerts from the oversight agent"
    >
      <div className="space-y-6">
        {/* Summary bar */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--background-card)] border border-[var(--border)]">
            <Bell className="w-4 h-4 text-[var(--verity-teal-accent)]" />
            <span className="text-sm font-medium">
              {unacknowledgedCount} unacknowledged
            </span>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="verity-heading">Alert History</CardTitle>
              <div className="flex gap-3">
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
                  </SelectContent>
                </Select>

                <Select
                  value={ackFilter || "all"}
                  onValueChange={(v) => setAckFilter(v === "all" ? "" : v)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="false">Unacknowledged</SelectItem>
                    <SelectItem value="true">Acknowledged</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-24 rounded-lg bg-[var(--background-secondary)] animate-pulse" />
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <XCircle className="w-12 h-12 mx-auto mb-2 text-red-500 opacity-50" />
                <p className="text-[var(--foreground-muted)]">Failed to load alerts</p>
                <Button variant="outline" className="mt-4" onClick={fetchAlerts}>
                  Retry
                </Button>
              </div>
            ) : alerts.length === 0 ? (
              <div className="text-center py-12 text-[var(--foreground-muted)]">
                <Shield className="w-12 h-12 mx-auto mb-2 text-emerald-500 opacity-50" />
                <p className="font-medium">No alerts</p>
                <p className="text-sm">All systems operating normally</p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-4 rounded-lg border ${
                        alert.acknowledged
                          ? "bg-[var(--background-secondary)] border-[var(--border)] opacity-75"
                          : alert.severity === "CRITICAL"
                          ? "bg-red-500/5 border-red-500/30"
                          : "bg-yellow-500/5 border-yellow-500/30"
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="mt-0.5">{getSeverityIcon(alert.severity)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            {getSeverityBadge(alert.severity)}
                            <Badge variant="outline">{alert.alertType}</Badge>
                            {alert.acknowledged && (
                              <Badge variant="secondary">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Acknowledged
                              </Badge>
                            )}
                          </div>
                          <p className="font-medium text-[var(--foreground)]">
                            {alert.title}
                          </p>
                          <p className="text-sm text-[var(--foreground-muted)] mt-1">
                            {alert.message}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-[var(--foreground-muted)]">
                            <span>{formatDate(alert.createdAt)}</span>
                            {alert.acknowledgedBy && (
                              <span>Acknowledged by {alert.acknowledgedBy}</span>
                            )}
                          </div>
                        </div>
                        {!alert.acknowledged && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => acknowledgeAlert(alert.id)}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Ack
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
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
