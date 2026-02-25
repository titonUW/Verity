"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Upload,
  Files,
  Shield,
  FileText,
  Settings,
  CheckCircle,
  Activity,
  Bell,
  Bot,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const monitorNav: NavItem[] = [
  { name: "Overview", href: "/", icon: LayoutDashboard },
  { name: "Alerts", href: "/alerts", icon: Bell },
];

const manageNav: NavItem[] = [
  { name: "File Intake", href: "/intake", icon: Upload },
  { name: "Files", href: "/files", icon: Files },
  { name: "Policies", href: "/policies", icon: Shield },
];

const oversightNav: NavItem[] = [
  { name: "Agent Reports", href: "/reports", icon: Bot, adminOnly: true },
];

const systemNav: NavItem[] = [
  { name: "Audit Log", href: "/audit", icon: FileText },
  { name: "Settings", href: "/settings", icon: Settings },
];

const externalNav: NavItem[] = [
  { name: "Public Verify", href: "/verify", icon: CheckCircle },
];

function NavSection({
  label,
  items,
  pathname,
  collapsed,
}: {
  label: string;
  items: NavItem[];
  pathname: string;
  collapsed: boolean;
}) {
  return (
    <div className="mb-2">
      {!collapsed && (
        <p className="px-3 mb-1 text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wider">
          {label}
        </p>
      )}
      {items.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.name}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            title={collapsed ? item.name : undefined}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              collapsed && "justify-center px-2",
              isActive
                ? "bg-[var(--verity-blue-primary)]/10 text-[var(--verity-teal-accent)] border-l-2 border-[var(--verity-teal-accent)]"
                : "text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--background-card)]"
            )}
          >
            <item.icon className="w-5 h-5 shrink-0" />
            {!collapsed && (
              <span className="truncate">{item.name}</span>
            )}
            {!collapsed && item.adminOnly && (
              <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-[var(--verity-blue-primary)]/20 text-[var(--verity-blue-primary)]">
                Admin
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={cn(
        "flex h-full flex-col bg-[var(--background-secondary)] border-r border-[var(--border)] transition-all duration-200",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-4 border-b border-[var(--border)]">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--verity-blue-primary)] to-[var(--verity-teal-accent)] shrink-0">
          <Shield className="w-6 h-6 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-[var(--foreground)]">Verity</h1>
            <p className="text-xs text-[var(--foreground-muted)]">Trust Infrastructure</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto" aria-label="Main navigation">
        <NavSection label="Monitor" items={monitorNav} pathname={pathname} collapsed={collapsed} />
        <NavSection label="Manage" items={manageNav} pathname={pathname} collapsed={collapsed} />
        <NavSection label="Oversight" items={oversightNav} pathname={pathname} collapsed={collapsed} />
        <NavSection label="System" items={systemNav} pathname={pathname} collapsed={collapsed} />
        <NavSection label="External" items={externalNav} pathname={pathname} collapsed={collapsed} />
      </nav>

      {/* Collapse toggle + status */}
      <div className="p-3 border-t border-[var(--border)] space-y-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full py-1.5 rounded-md text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--background-card)] transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4 mr-2" />
              <span className="text-xs">Collapse</span>
            </>
          )}
        </button>
        <div className={cn(
          "flex items-center gap-2 px-2 py-2 rounded-md bg-[var(--background-card)]",
          collapsed && "justify-center px-1"
        )}>
          <Activity className="w-4 h-4 text-emerald-500 shrink-0" />
          {!collapsed && (
            <span className="text-xs text-[var(--foreground-muted)]">System Online</span>
          )}
          <span className={cn("w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0", !collapsed && "ml-auto")} />
        </div>
      </div>
    </div>
  );
}
