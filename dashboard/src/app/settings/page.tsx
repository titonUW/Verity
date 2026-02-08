"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Key,
  Link,
  Palette,
  Users,
  Plus,
  Trash2,
  Shield,
  Server,
} from "lucide-react";

export default function SettingsPage() {
  const [trustedKeys, setTrustedKeys] = useState([
    { id: "1", keyId: "device_capture_01", name: "Capture Device 1", active: true },
    { id: "2", keyId: "device_capture_02", name: "Capture Device 2", active: true },
    { id: "3", keyId: "signing_key_01", name: "Signing Authority", active: true },
  ]);

  const [logSettings, setLogSettings] = useState({
    endpoint: "",
    publicKey: "",
  });

  const [users] = useState([
    { id: "1", email: "admin@verity.local", name: "Admin User", role: "ADMIN" },
    { id: "2", email: "analyst@verity.local", name: "Analyst User", role: "ANALYST" },
    { id: "3", email: "viewer@verity.local", name: "Viewer User", role: "VIEWER" },
  ]);

  return (
    <DashboardLayout
      title="Settings"
      description="Configure Verity Dashboard settings"
    >
      <Tabs defaultValue="keys" className="space-y-6">
        <TabsList>
          <TabsTrigger value="keys" className="gap-2">
            <Key className="w-4 h-4" />
            Trusted Keys
          </TabsTrigger>
          <TabsTrigger value="log" className="gap-2">
            <Server className="w-4 h-4" />
            Transparency Log
          </TabsTrigger>
          <TabsTrigger value="branding" className="gap-2">
            <Palette className="w-4 h-4" />
            Branding
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="w-4 h-4" />
            Users
          </TabsTrigger>
        </TabsList>

        {/* Trusted Keys */}
        <TabsContent value="keys">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Trusted Capture Keys</CardTitle>
                  <CardDescription>
                    Public keys from trusted capture devices and signing authorities
                  </CardDescription>
                </div>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Key
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {trustedKeys.map((key) => (
                  <div
                    key={key.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-[var(--background-secondary)]"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-[var(--verity-blue-primary)]/20 flex items-center justify-center">
                        <Key className="w-5 h-5 text-[var(--verity-blue-primary)]" />
                      </div>
                      <div>
                        <p className="font-medium">{key.name}</p>
                        <p className="text-sm text-[var(--foreground-muted)] font-mono">
                          {key.keyId}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={key.active ? "success" : "secondary"}>
                        {key.active ? "Active" : "Inactive"}
                      </Badge>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transparency Log */}
        <TabsContent value="log">
          <Card>
            <CardHeader>
              <CardTitle>Transparency Log Configuration</CardTitle>
              <CardDescription>
                Connect to an external transparency log service for content registration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Log Endpoint URL</Label>
                <Input
                  placeholder="https://log.verity.example/api"
                  value={logSettings.endpoint}
                  onChange={(e) =>
                    setLogSettings({ ...logSettings, endpoint: e.target.value })
                  }
                />
                <p className="text-xs text-[var(--foreground-muted)]">
                  Leave empty to use built-in demo log
                </p>
              </div>
              <div className="space-y-2">
                <Label>Log Public Key</Label>
                <Input
                  placeholder="Ed25519 public key (hex)"
                  value={logSettings.publicKey}
                  onChange={(e) =>
                    setLogSettings({ ...logSettings, publicKey: e.target.value })
                  }
                  className="font-mono"
                />
                <p className="text-xs text-[var(--foreground-muted)]">
                  Used to verify signed checkpoints from the log
                </p>
              </div>
              <Button>Save Configuration</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Branding */}
        <TabsContent value="branding">
          <Card>
            <CardHeader>
              <CardTitle>Branding Preview</CardTitle>
              <CardDescription>
                Verity design system colors and typography
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-8">
                {/* Colors */}
                <div>
                  <h4 className="font-medium mb-4">Colors</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="w-full h-16 rounded-lg bg-[var(--verity-blue-primary)]" />
                      <p className="text-sm mt-2">Primary Blue</p>
                      <p className="text-xs text-[var(--foreground-muted)]">#005CCE</p>
                    </div>
                    <div>
                      <div className="w-full h-16 rounded-lg bg-[var(--verity-blue-secondary)]" />
                      <p className="text-sm mt-2">Secondary Blue</p>
                      <p className="text-xs text-[var(--foreground-muted)]">#0088CF</p>
                    </div>
                    <div>
                      <div className="w-full h-16 rounded-lg bg-[var(--verity-teal-accent)]" />
                      <p className="text-sm mt-2">Accent Teal</p>
                      <p className="text-xs text-[var(--foreground-muted)]">#05B8BC</p>
                    </div>
                    <div>
                      <div className="w-full h-16 rounded-lg bg-[var(--background-card)] border border-[var(--border)]" />
                      <p className="text-sm mt-2">Card Background</p>
                      <p className="text-xs text-[var(--foreground-muted)]">#1E293B</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Decision Badges */}
                <div>
                  <h4 className="font-medium mb-4">Decision Badges</h4>
                  <div className="flex gap-3">
                    <Badge variant="allow">ALLOW</Badge>
                    <Badge variant="warn">WARN</Badge>
                    <Badge variant="require">REQUIRE</Badge>
                    <Badge variant="block">BLOCK</Badge>
                  </div>
                </div>

                <Separator />

                {/* Typography */}
                <div>
                  <h4 className="font-medium mb-4">Typography</h4>
                  <div className="space-y-2">
                    <p className="text-2xl">Heading Text (24px)</p>
                    <p className="text-lg">Subheading Text (18px)</p>
                    <p className="text-base">Body Text (14px)</p>
                    <p className="text-sm text-[var(--foreground-muted)]">Muted Text (14px)</p>
                    <p className="text-xs text-[var(--foreground-muted)]">Small Text (12px)</p>
                    <p className="font-mono">Monospace Text</p>
                  </div>
                </div>

                <Separator />

                {/* Components */}
                <div>
                  <h4 className="font-medium mb-4">Buttons</h4>
                  <div className="flex gap-3 flex-wrap">
                    <Button>Primary</Button>
                    <Button variant="secondary">Secondary</Button>
                    <Button variant="outline">Outline</Button>
                    <Button variant="ghost">Ghost</Button>
                    <Button variant="destructive">Destructive</Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>User Management</CardTitle>
                  <CardDescription>
                    Manage user accounts and roles (POC - local authentication)
                  </CardDescription>
                </div>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add User
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-[var(--background-secondary)]"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-[var(--verity-teal-accent)]/20 flex items-center justify-center">
                        <Users className="w-5 h-5 text-[var(--verity-teal-accent)]" />
                      </div>
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-sm text-[var(--foreground-muted)]">{user.email}</p>
                      </div>
                    </div>
                    <Badge
                      variant={
                        user.role === "ADMIN" ? "destructive" :
                        user.role === "ANALYST" ? "default" :
                        "secondary"
                      }
                    >
                      {user.role}
                    </Badge>
                  </div>
                ))}
              </div>
              <p className="text-sm text-[var(--foreground-muted)] mt-4">
                Note: This is a POC. In production, integrate with your identity provider.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
