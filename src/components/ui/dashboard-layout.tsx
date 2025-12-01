"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sidebarCollapsed");
      return saved === "true";
    }
    return false;
  });
  const [sidebarHidden, setSidebarHidden] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sidebarHidden");
      return saved === "true";
    }
    return false;
  });

  useEffect(() => {
    // Listen for changes to localStorage (when sidebar is toggled)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "sidebarCollapsed" && e.newValue !== null) {
        setSidebarCollapsed(e.newValue === "true");
      }
      if (e.key === "sidebarHidden" && e.newValue !== null) {
        setSidebarHidden(e.newValue === "true");
      }
    };

    // Listen for custom event (for same-window updates)
    const handleSidebarToggle = () => {
      const savedCollapsed = localStorage.getItem("sidebarCollapsed");
      const savedHidden = localStorage.getItem("sidebarHidden");
      if (savedCollapsed !== null) {
        setSidebarCollapsed(savedCollapsed === "true");
      }
      if (savedHidden !== null) {
        setSidebarHidden(savedHidden === "true");
      }
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("sidebarToggle", handleSidebarToggle);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("sidebarToggle", handleSidebarToggle);
    };
  }, []);

  return (
    <main className="flex min-h-screen w-full relative z-0">
      {/* Spacer for sidebar */}
      <div 
        className={cn(
          "transition-all duration-300",
          sidebarHidden ? "w-0" : sidebarCollapsed ? "w-16" : "w-64"
        )} 
        aria-hidden="true" 
      />
      
      {/* Main content */}
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 relative z-0">
        {children}
      </div>
    </main>
  );
}

