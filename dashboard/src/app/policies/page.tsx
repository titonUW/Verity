"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Plus, Save, History, CheckCircle } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface PolicyConfig {
  workflow_name: string;
  description: string;
  version: string;
  min_confidence: number;
  require_human_origin: boolean;
  require_transparency_log: boolean;
  decision_rules: Array<{
    id: string;
    condition: string;
    decision: string;
    rationale: string;
  }>;
}

interface PolicyVersion {
  id: string;
  version: string;
  publishedAt: string;
  isActive: boolean;
  policy: PolicyConfig;
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  versions: PolicyVersion[];
}

export default function PoliciesPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
  const [editingPolicy, setEditingPolicy] = useState<PolicyConfig | null>(null);

  useEffect(() => {
    async function fetchPolicies() {
      try {
        const res = await fetch("/api/policies");
        if (res.ok) {
          const data = await res.json();
          setWorkflows(data);
          if (data.length > 0) {
            setSelectedWorkflow(data[0].name);
            const activeVersion = data[0].versions.find((v: PolicyVersion) => v.isActive);
            if (activeVersion) {
              setEditingPolicy(activeVersion.policy);
            }
          }
        }
      } catch (error) {
        console.error("Failed to fetch policies:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchPolicies();
  }, []);

  const handleWorkflowSelect = (name: string) => {
    setSelectedWorkflow(name);
    const workflow = workflows.find((w) => w.name === name);
    if (workflow) {
      const activeVersion = workflow.versions.find((v) => v.isActive);
      if (activeVersion) {
        setEditingPolicy({ ...activeVersion.policy });
      }
    }
  };

  const handleSavePolicy = async () => {
    if (!editingPolicy || !selectedWorkflow) return;

    try {
      const res = await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowName: selectedWorkflow,
          policy: {
            ...editingPolicy,
            version: `${parseFloat(editingPolicy.version) + 0.1}`.substring(0, 5),
          },
        }),
      });

      if (res.ok) {
        // Refresh policies
        const refreshRes = await fetch("/api/policies");
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          setWorkflows(data);
        }
      }
    } catch (error) {
      console.error("Failed to save policy:", error);
    }
  };

  const currentWorkflow = workflows.find((w) => w.name === selectedWorkflow);

  return (
    <DashboardLayout
      title="Policies & Workflows"
      description="Configure verification policies for each workflow"
    >
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Workflow List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="verity-heading text-base">Workflows</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-[var(--foreground-muted)]">Loading...</p>
            ) : (
              <div className="space-y-2">
                {workflows.map((workflow) => (
                  <button
                    key={workflow.name}
                    onClick={() => handleWorkflowSelect(workflow.name)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      selectedWorkflow === workflow.name
                        ? "bg-[var(--verity-blue-primary)]/10 border border-[var(--verity-blue-primary)]/30"
                        : "hover:bg-[var(--background-secondary)]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-[var(--verity-teal-accent)]" />
                      <span className="font-medium text-sm">{workflow.name}</span>
                    </div>
                    <p className="text-xs text-[var(--foreground-muted)] mt-1 line-clamp-1">
                      {workflow.description}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Policy Editor */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{selectedWorkflow || "Select a workflow"}</CardTitle>
                <CardDescription>
                  {currentWorkflow?.description || "Choose a workflow to edit its policy"}
                </CardDescription>
              </div>
              {editingPolicy && (
                <Button onClick={handleSavePolicy}>
                  <Save className="w-4 h-4 mr-2" />
                  Publish New Version
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {editingPolicy ? (
              <Tabs defaultValue="settings">
                <TabsList>
                  <TabsTrigger value="settings">Settings</TabsTrigger>
                  <TabsTrigger value="rules">Decision Rules</TabsTrigger>
                  <TabsTrigger value="history">Version History</TabsTrigger>
                </TabsList>

                <TabsContent value="settings" className="space-y-6 mt-4">
                  {/* Basic Settings */}
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Minimum Confidence</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={editingPolicy.min_confidence}
                        onChange={(e) =>
                          setEditingPolicy({
                            ...editingPolicy,
                            min_confidence: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                      <p className="text-xs text-[var(--foreground-muted)]">
                        Minimum score required (0-100)
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Current Version</Label>
                      <Input value={editingPolicy.version} disabled />
                    </div>
                  </div>

                  <Separator />

                  {/* Requirements */}
                  <div className="space-y-4">
                    <h4 className="font-medium">Hard Requirements</h4>
                    <div className="flex items-center justify-between p-4 rounded-lg bg-[var(--background-secondary)]">
                      <div>
                        <p className="font-medium">Require Human Origin</p>
                        <p className="text-sm text-[var(--foreground-muted)]">
                          File must have verified human-origin proof
                        </p>
                      </div>
                      <Switch
                        checked={editingPolicy.require_human_origin}
                        onCheckedChange={(checked) =>
                          setEditingPolicy({
                            ...editingPolicy,
                            require_human_origin: checked,
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-lg bg-[var(--background-secondary)]">
                      <div>
                        <p className="font-medium">Require Transparency Log</p>
                        <p className="text-sm text-[var(--foreground-muted)]">
                          File must be recorded in transparency log
                        </p>
                      </div>
                      <Switch
                        checked={editingPolicy.require_transparency_log}
                        onCheckedChange={(checked) =>
                          setEditingPolicy({
                            ...editingPolicy,
                            require_transparency_log: checked,
                          })
                        }
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="rules" className="space-y-4 mt-4">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-[var(--foreground-muted)]">
                      Rules are evaluated in order. First matching rule determines the decision.
                    </p>
                  </div>
                  {editingPolicy.decision_rules.map((rule, idx) => (
                    <div
                      key={rule.id}
                      className="p-4 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)]"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-[var(--foreground-muted)]">#{idx + 1}</span>
                          <Badge variant="outline">{rule.id}</Badge>
                        </div>
                        <Badge
                          variant={
                            rule.decision === "ALLOW" ? "allow" :
                            rule.decision === "WARN" ? "warn" :
                            rule.decision === "BLOCK" ? "block" :
                            "require"
                          }
                        >
                          {rule.decision}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <Label className="text-xs">Condition</Label>
                          <Input
                            value={rule.condition}
                            onChange={(e) => {
                              const newRules = [...editingPolicy.decision_rules];
                              newRules[idx] = { ...rule, condition: e.target.value };
                              setEditingPolicy({ ...editingPolicy, decision_rules: newRules });
                            }}
                            className="font-mono text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Rationale</Label>
                          <Input
                            value={rule.rationale}
                            onChange={(e) => {
                              const newRules = [...editingPolicy.decision_rules];
                              newRules[idx] = { ...rule, rationale: e.target.value };
                              setEditingPolicy({ ...editingPolicy, decision_rules: newRules });
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="history" className="mt-4">
                  {currentWorkflow?.versions.map((version) => (
                    <div
                      key={version.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-[var(--background-secondary)] mb-2"
                    >
                      <div className="flex items-center gap-3">
                        <History className="w-4 h-4 text-[var(--foreground-muted)]" />
                        <div>
                          <p className="font-medium">Version {version.version}</p>
                          <p className="text-sm text-[var(--foreground-muted)]">
                            {formatDate(version.publishedAt)}
                          </p>
                        </div>
                      </div>
                      {version.isActive && (
                        <Badge variant="success">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Active
                        </Badge>
                      )}
                    </div>
                  ))}
                </TabsContent>
              </Tabs>
            ) : (
              <div className="text-center py-12 text-[var(--foreground-muted)]">
                <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Select a workflow to view and edit its policy</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
