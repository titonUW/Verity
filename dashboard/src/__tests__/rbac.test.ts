import { describe, it, expect } from "vitest";
import { hasPermission, getRolePermissions, type Role } from "../lib/rbac";

describe("hasPermission", () => {
  it("ADMIN has all permissions", () => {
    expect(hasPermission("ADMIN", "dashboard.view")).toBe(true);
    expect(hasPermission("ADMIN", "agent.run")).toBe(true);
    expect(hasPermission("ADMIN", "agent.configure")).toBe(true);
    expect(hasPermission("ADMIN", "alerts.acknowledge")).toBe(true);
    expect(hasPermission("ADMIN", "users.manage")).toBe(true);
    expect(hasPermission("ADMIN", "policies.edit")).toBe(true);
    expect(hasPermission("ADMIN", "settings.edit")).toBe(true);
  });

  it("ANALYST can view reports and alerts but not run agent", () => {
    expect(hasPermission("ANALYST", "reports.view")).toBe(true);
    expect(hasPermission("ANALYST", "alerts.view")).toBe(true);
    expect(hasPermission("ANALYST", "agent.run")).toBe(false);
    expect(hasPermission("ANALYST", "agent.configure")).toBe(false);
    expect(hasPermission("ANALYST", "alerts.acknowledge")).toBe(false);
  });

  it("ANALYST can intake and verify files", () => {
    expect(hasPermission("ANALYST", "files.intake")).toBe(true);
    expect(hasPermission("ANALYST", "files.verify")).toBe(true);
    expect(hasPermission("ANALYST", "files.view")).toBe(true);
  });

  it("ANALYST cannot edit policies or manage users", () => {
    expect(hasPermission("ANALYST", "policies.edit")).toBe(false);
    expect(hasPermission("ANALYST", "users.manage")).toBe(false);
    expect(hasPermission("ANALYST", "settings.edit")).toBe(false);
  });

  it("VIEWER has minimal read-only access", () => {
    expect(hasPermission("VIEWER", "dashboard.view")).toBe(true);
    expect(hasPermission("VIEWER", "files.view")).toBe(true);
    expect(hasPermission("VIEWER", "audit.view")).toBe(true);
    expect(hasPermission("VIEWER", "settings.view")).toBe(true);
  });

  it("VIEWER cannot access oversight features", () => {
    expect(hasPermission("VIEWER", "reports.view")).toBe(false);
    expect(hasPermission("VIEWER", "alerts.view")).toBe(false);
    expect(hasPermission("VIEWER", "agent.run")).toBe(false);
    expect(hasPermission("VIEWER", "files.intake")).toBe(false);
    expect(hasPermission("VIEWER", "files.verify")).toBe(false);
    expect(hasPermission("VIEWER", "policies.edit")).toBe(false);
  });

  it("returns false for unknown permissions", () => {
    expect(hasPermission("ADMIN", "nonexistent.permission")).toBe(false);
  });

  it("returns false for invalid role", () => {
    expect(hasPermission("SUPERADMIN" as Role, "dashboard.view")).toBe(false);
  });
});

describe("getRolePermissions", () => {
  it("returns correct number of permissions per role", () => {
    const admin = getRolePermissions("ADMIN");
    const analyst = getRolePermissions("ANALYST");
    const viewer = getRolePermissions("VIEWER");

    expect(admin.length).toBeGreaterThan(analyst.length);
    expect(analyst.length).toBeGreaterThan(viewer.length);
    expect(viewer.length).toBeGreaterThan(0);
  });

  it("admin permissions include all analyst permissions", () => {
    const admin = new Set(getRolePermissions("ADMIN"));
    const analyst = getRolePermissions("ANALYST");

    for (const perm of analyst) {
      expect(admin.has(perm)).toBe(true);
    }
  });

  it("admin permissions include all viewer permissions", () => {
    const admin = new Set(getRolePermissions("ADMIN"));
    const viewer = getRolePermissions("VIEWER");

    for (const perm of viewer) {
      expect(admin.has(perm)).toBe(true);
    }
  });
});
