/**
 * RBAC — Role-Based Access Control for Verity Dashboard
 *
 * POC implementation using cookie-based session with user ID.
 * In production, replace with NextAuth or similar.
 */

import { cookies } from "next/headers";
import { prisma } from "./prisma";

export type Role = "ADMIN" | "ANALYST" | "VIEWER";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

// Permissions matrix: which roles can access which features
const ROLE_PERMISSIONS: Record<Role, Set<string>> = {
  ADMIN: new Set([
    "dashboard.view",
    "files.view",
    "files.intake",
    "files.verify",
    "policies.view",
    "policies.edit",
    "audit.view",
    "audit.export",
    "settings.view",
    "settings.edit",
    "reports.view",
    "alerts.view",
    "alerts.acknowledge",
    "agent.run",
    "agent.configure",
    "users.manage",
  ]),
  ANALYST: new Set([
    "dashboard.view",
    "files.view",
    "files.intake",
    "files.verify",
    "policies.view",
    "audit.view",
    "audit.export",
    "settings.view",
    "reports.view",
    "alerts.view",
  ]),
  VIEWER: new Set([
    "dashboard.view",
    "files.view",
    "audit.view",
    "settings.view",
  ]),
};

/**
 * Get current session user from cookie.
 * Returns null if not authenticated.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const userId = cookieStore.get("verity_user_id")?.value;

  if (!userId) return null;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role,
    };
  } catch {
    return null;
  }
}

/**
 * Check if a role has a specific permission.
 */
export function hasPermission(role: Role, permission: string): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

/**
 * Require a specific permission for an API route.
 * Returns the user if authorized, or a Response with 401/403.
 */
export async function requirePermission(
  permission: string
): Promise<{ user: SessionUser } | { error: Response }> {
  const user = await getSessionUser();

  if (!user) {
    // For POC, default to admin if no cookie is set (allows demo usage)
    // In production, this would return a 401
    const defaultUser: SessionUser = {
      id: "default",
      email: "admin@verity.local",
      name: "Admin (Default)",
      role: "ADMIN",
    };
    if (hasPermission(defaultUser.role, permission)) {
      return { user: defaultUser };
    }
    return {
      error: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }

  if (!hasPermission(user.role, permission)) {
    return {
      error: new Response(
        JSON.stringify({ error: "Forbidden", required: permission, role: user.role }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      ),
    };
  }

  return { user };
}

/**
 * Check if the current user has a permission (client-side friendly).
 * Returns the role from cookie, or "ADMIN" as default for POC.
 */
export function getRolePermissions(role: Role): string[] {
  return Array.from(ROLE_PERMISSIONS[role] ?? []);
}
