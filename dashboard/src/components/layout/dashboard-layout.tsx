"use client";

import { Sidebar } from "./sidebar";
import { Header } from "./header";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export function DashboardLayout({ children, title, description }: DashboardLayoutProps) {
  return (
    <div className="flex h-screen bg-[var(--background)]">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-2 focus:bg-[var(--verity-blue-primary)] focus:text-white">
        Skip to content
      </a>
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header title={title} description={description} />
        <main id="main-content" role="main" className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
