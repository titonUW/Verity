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
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Overview", href: "/", icon: LayoutDashboard },
  { name: "File Intake", href: "/intake", icon: Upload },
  { name: "Files", href: "/files", icon: Files },
  { name: "Policies", href: "/policies", icon: Shield },
  { name: "Audit Log", href: "/audit", icon: FileText },
  { name: "Settings", href: "/settings", icon: Settings },
];

const secondaryNavigation = [
  { name: "Public Verify", href: "/verify", icon: CheckCircle },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-64 flex-col bg-[var(--background-secondary)] border-r border-[var(--border)]">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-6 border-b border-[var(--border)]">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--verity-blue-primary)] to-[var(--verity-teal-accent)]">
          <Shield className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-[var(--foreground)]">Verity</h1>
          <p className="text-xs text-[var(--foreground-muted)]">Trust Infrastructure</p>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        <p className="px-3 mb-2 text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wider">
          Main
        </p>
        {navigation.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-[var(--verity-blue-primary)]/10 text-[var(--verity-teal-accent)] border-l-2 border-[var(--verity-teal-accent)]"
                  : "text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--background-card)]"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </Link>
          );
        })}

        <div className="pt-4">
          <p className="px-3 mb-2 text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wider">
            External
          </p>
          {secondaryNavigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-[var(--verity-blue-primary)]/10 text-[var(--verity-teal-accent)] border-l-2 border-[var(--verity-teal-accent)]"
                    : "text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--background-card)]"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Status Footer */}
      <div className="p-4 border-t border-[var(--border)]">
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-[var(--background-card)]">
          <Activity className="w-4 h-4 text-emerald-500" />
          <span className="text-sm text-[var(--foreground-muted)]">System Online</span>
          <span className="ml-auto w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
