"use client";

import { useEffect, useState } from "react";
import {
  Files,
  CheckCircle,
  AlertTriangle,
  XCircle,
  TrendingUp,
  User,
  Shield,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { DashboardStats } from "@/lib/types";

function KPICard({
  title,
  value,
  icon: Icon,
  trend,
  color,
}: {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  trend?: string;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-[var(--foreground-muted)]">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            {trend && (
              <p className="text-xs text-emerald-500 mt-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                {trend}
              </p>
            )}
          </div>
          <div
            className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}
          >
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AlertItem({
  title,
  description,
  severity,
  time,
}: {
  title: string;
  description: string;
  severity: "high" | "medium" | "low";
  time: string;
}) {
  const colors = {
    high: "border-l-red-500 bg-red-500/5",
    medium: "border-l-yellow-500 bg-yellow-500/5",
    low: "border-l-blue-500 bg-blue-500/5",
  };

  return (
    <div className={`p-4 rounded-r-lg border-l-4 ${colors[severity]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-[var(--foreground)]">{title}</p>
          <p className="text-sm text-[var(--foreground-muted)] mt-1">
            {description}
          </p>
        </div>
        <span className="text-xs text-[var(--foreground-muted)]">{time}</span>
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/stats");
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  const displayStats = stats || {
    totalFiles: 0,
    verified: 0,
    warnings: 0,
    blocks: 0,
    avgConfidence: 0,
    humanOriginYes: 0,
    humanOriginTotal: 0,
  };

  const humanOriginPercent =
    displayStats.humanOriginTotal > 0
      ? Math.round(
          (displayStats.humanOriginYes / displayStats.humanOriginTotal) * 100
        )
      : 0;

  return (
    <DashboardLayout
      title="Dashboard Overview"
      description="Trust infrastructure monitoring and analytics"
    >
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <KPICard
            title="Total Files"
            value={displayStats.totalFiles}
            icon={Files}
            color="bg-[var(--verity-blue-primary)]/20 text-[var(--verity-blue-primary)]"
          />
          <KPICard
            title="Verified"
            value={displayStats.verified}
            icon={CheckCircle}
            color="bg-emerald-500/20 text-emerald-500"
          />
          <KPICard
            title="Warnings"
            value={displayStats.warnings}
            icon={AlertTriangle}
            color="bg-yellow-500/20 text-yellow-500"
          />
          <KPICard
            title="Blocked"
            value={displayStats.blocks}
            icon={XCircle}
            color="bg-red-500/20 text-red-500"
          />
          <KPICard
            title="Avg Confidence"
            value={`${displayStats.avgConfidence}%`}
            icon={TrendingUp}
            color="bg-[var(--verity-teal-accent)]/20 text-[var(--verity-teal-accent)]"
          />
          <KPICard
            title="Human Origin"
            value={`${humanOriginPercent}%`}
            icon={User}
            color="bg-purple-500/20 text-purple-500"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Decision Distribution */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="verity-heading">Decision Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-[var(--foreground-muted)]">ALLOW</span>
                    <span className="text-emerald-500">
                      {Math.max(0, displayStats.verified - displayStats.warnings - displayStats.blocks)}
                    </span>
                  </div>
                  <Progress
                    value={
                      displayStats.verified > 0
                        ? (Math.max(0, displayStats.verified - displayStats.warnings - displayStats.blocks) /
                            displayStats.verified) *
                          100
                        : 0
                    }
                    indicatorClassName="bg-emerald-500"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-[var(--foreground-muted)]">WARN</span>
                    <span className="text-yellow-500">{displayStats.warnings}</span>
                  </div>
                  <Progress
                    value={
                      displayStats.verified > 0
                        ? (displayStats.warnings / displayStats.verified) * 100
                        : 0
                    }
                    indicatorClassName="bg-yellow-500"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-[var(--foreground-muted)]">BLOCK</span>
                    <span className="text-red-500">{displayStats.blocks}</span>
                  </div>
                  <Progress
                    value={
                      displayStats.verified > 0
                        ? (displayStats.blocks / displayStats.verified) * 100
                        : 0
                    }
                    indicatorClassName="bg-red-500"
                  />
                </div>
              </div>

              {/* Confidence Score Distribution */}
              <div className="mt-8">
                <h4 className="text-sm font-medium text-[var(--foreground-muted)] mb-4">
                  Confidence Score Overview
                </h4>
                <div className="flex items-center justify-center gap-8">
                  <div className="text-center">
                    <div className="w-24 h-24 rounded-full border-4 border-[var(--verity-teal-accent)] flex items-center justify-center">
                      <span className="text-2xl font-bold">{displayStats.avgConfidence}</span>
                    </div>
                    <p className="text-sm text-[var(--foreground-muted)] mt-2">Average Score</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-emerald-500" />
                      <span className="text-sm">90-100: Grade A</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <span className="text-sm">80-89: Grade B</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-yellow-500" />
                      <span className="text-sm">70-79: Grade C</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-orange-500" />
                      <span className="text-sm">60-69: Grade D</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <span className="text-sm">&lt;60: Grade F</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Alerts Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="verity-heading">Recent Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {displayStats.blocks > 0 && (
                  <AlertItem
                    title="Files Blocked"
                    description={`${displayStats.blocks} file(s) failed verification`}
                    severity="high"
                    time="Recent"
                  />
                )}
                {displayStats.warnings > 0 && (
                  <AlertItem
                    title="Warnings Issued"
                    description={`${displayStats.warnings} file(s) need review`}
                    severity="medium"
                    time="Recent"
                  />
                )}
                {displayStats.totalFiles === 0 && (
                  <AlertItem
                    title="No Files Yet"
                    description="Upload files via the Intake page to get started"
                    severity="low"
                    time="Now"
                  />
                )}
                {displayStats.totalFiles > 0 && displayStats.blocks === 0 && displayStats.warnings === 0 && (
                  <div className="text-center py-8 text-[var(--foreground-muted)]">
                    <Shield className="w-12 h-12 mx-auto mb-2 text-emerald-500" />
                    <p>All systems nominal</p>
                    <p className="text-sm">No high-risk items detected</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Workflow Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="verity-heading">Active Workflows</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                { name: "Vendor Bank Change", security: "High", color: "text-yellow-500" },
                { name: "Wire Transfer", security: "Maximum", color: "text-red-500" },
                { name: "HR Offer Letter", security: "Medium", color: "text-blue-500" },
                { name: "Insurance Claim", security: "High", color: "text-yellow-500" },
                { name: "Content Publishing", security: "Standard", color: "text-green-500" },
              ].map((workflow) => (
                <div
                  key={workflow.name}
                  className="p-4 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)]"
                >
                  <p className="font-medium text-[var(--foreground)]">{workflow.name}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className={workflow.color}>
                      {workflow.security}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
