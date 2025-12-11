"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Menu, 
  X, 
  Home, 
  LayoutDashboard, 
  LogIn, 
  UserPlus,
  Shield,
  Users,
  Settings,
  Download,
  Bell,
  Database,
  AlertTriangle,
  Key,
  Trash2,
  ChevronRight,
  Loader2,
  LineChart
} from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { logoutWithoutRedirect } from "@/actions/auth";

interface NavigationProps {
  isAuthenticated?: boolean;
  userEmail?: string;
  userRole?: "admin" | "user";
}

export function Navigation({ 
  isAuthenticated = false, 
  userEmail,
  userRole = "user" 
}: NavigationProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const pathname = usePathname();

  // Load sidebar state from localStorage after mount to avoid hydration mismatch
  useEffect(() => {
    const savedCollapsed = localStorage.getItem("sidebarCollapsed");
    const savedHidden = localStorage.getItem("sidebarHidden");
    if (savedCollapsed === "true") setSidebarCollapsed(true);
    if (savedHidden === "true") setSidebarHidden(true);
  }, []);

  // Toggle sidebar completely hidden
  const toggleSidebarHidden = () => {
    const newState = !sidebarHidden;
    setSidebarHidden(newState);
    localStorage.setItem("sidebarHidden", String(newState));
    // Dispatch custom event for same-window updates
    window.dispatchEvent(new Event("sidebarToggle"));
  };

  // Keyboard shortcut to toggle sidebar (Ctrl+B or Cmd+B)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        toggleSidebarHidden();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidebarHidden]);

  // Save collapsed state to localStorage and notify other components
  const toggleSidebarCollapse = () => {
    const newState = !sidebarCollapsed;
    setSidebarCollapsed(newState);
    localStorage.setItem("sidebarCollapsed", String(newState));
    // Dispatch custom event for same-window updates
    window.dispatchEvent(new Event("sidebarToggle"));
  };

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Prevent scroll when sidebar is open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  const isActive = (href: string) => {
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/a101187a-72de-4f32-8b8f-fe2762640cce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'navigation.tsx:104',message:'isActive called',data:{pathname,href},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    if (!pathname) return false;
    
    // Normalize paths by removing trailing slashes (except for root)
    const normalizedPathname = pathname === "/" ? "/" : pathname.replace(/\/$/, "");
    const normalizedHref = href === "/" ? "/" : href.replace(/\/$/, "");
    
    if (normalizedHref === "/") return normalizedPathname === "/";
    
    // Exact match
    if (normalizedPathname === normalizedHref) return true;
    
    // Special case: "/admin" is a specific page (Auth Logs), not a parent route
    // It should only match exactly, not as a prefix
    if (normalizedHref === "/admin") {
      return false; // Only exact match (handled above)
    }
    
    // For prefix matches, ensure we're matching a complete path segment
    // e.g., "/admin-dashboard" should only match "/admin-dashboard", not "/admin-dashboard/..."
    // e.g., "/admin-devicemonitoring" should match "/admin-devicemonitoring" and "/admin-devicemonitoring/..."
    return normalizedPathname.startsWith(normalizedHref + "/");
  };

  // Navigation items for non-authenticated users
  const publicNavItems = [
    { id: "home", href: "/", label: "Home", icon: Home },
  ];

  // Admin navigation structure
  const adminNavStructure = [
    {
      section: "Overview",
      items: [
        { id: "dashboard", href: "/admin-dashboard", label: "Dashboard", icon: LayoutDashboard, variant: undefined },
        { id: "device-monitoring", href: "/admin-devicemonitoring", label: "Device Monitoring", icon: LineChart, variant: undefined },
      ]
    },
    {
      section: "Management",
      items: [
        { id: "user-management", href: "/admin/users", label: "User Management", icon: Users, variant: undefined },
        { id: "auth-logs", href: "/admin", label: "Auth Logs", icon: Shield, variant: undefined },
      ]
    },
    {
      section: "Administrative",
      items: [
        { id: "system-settings", href: "/admin/settings", label: "System Settings", icon: Settings, variant: undefined },
        { id: "export-reports", href: "/admin/reports", label: "Export Reports", icon: Download, variant: undefined },
        { id: "backup-data", href: "/admin/backup", label: "Backup Data", icon: Database, variant: undefined },
        { id: "alert-config", href: "/admin/alerts", label: "Alert Configuration", icon: AlertTriangle, variant: undefined },
        { id: "api-keys", href: "/admin/api-keys", label: "API Keys", icon: Key, variant: undefined },
      ]
    },
    {
      section: "Actions",
      items: [
        { id: "clear-cache", href: "#", label: "Clear Cache", icon: Trash2, variant: "destructive" as const },
      ]
    }
  ];

  // User navigation structure
  const userNavStructure = [
    {
      section: "Main",
      items: [
        { id: "user-dashboard", href: "/user-dashboard", label: "Dashboard", icon: LayoutDashboard, variant: undefined },
      ]
    },
    {
      section: "Tools",
      items: [
        { id: "user-export", href: "/user/export", label: "Export Data", icon: Download, variant: undefined },
        { id: "user-alerts", href: "/user/alerts", label: "Alerts", icon: Bell, variant: undefined },
        { id: "user-settings", href: "/user/settings", label: "Settings", icon: Settings, variant: undefined },
      ]
    }
  ];

  const navStructure = userRole === "admin" ? adminNavStructure : userNavStructure;

  return (
    <>
      {/* Top Navigation Bar */}
      <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          {/* Logo */}
          <Link 
            href={isAuthenticated ? (userRole === "admin" ? "/admin-dashboard" : "/user-dashboard") : "/"} 
            className="group flex items-center gap-2 text-xl font-semibold tracking-tight transition-colors hover:text-primary"
            aria-label="IoT Room Temperature"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-sm transition-transform group-hover:scale-105">
              <LayoutDashboard className="h-4 w-4" />
            </div>
            <span className="hidden sm:inline-block">IoT Room Temperature</span>
            <span className="sm:hidden">IoT Temp</span>
          </Link>

          {/* Desktop Navigation for Public Pages */}
          {!isAuthenticated && (
            <div className="hidden items-center gap-6 md:flex">
              {publicNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => {
                    // #region agent log
                    fetch('http://127.0.0.1:7244/ingest/a101187a-72de-4f32-8b8f-fe2762640cce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'navigation.tsx:210',message:'Home link clicked',data:{href:item.href,pathname},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                    // #endregion
                  }}
                  className={cn(
                    "flex items-center gap-2 text-sm font-medium transition-colors hover:text-foreground",
                    isActive(item.href) ? "text-foreground" : "text-muted-foreground"
                  )}
                  aria-current={isActive(item.href) ? "page" : undefined}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
              <Link href="/login">
                <Button variant="ghost" size="sm" className="gap-2">
                  <LogIn className="h-4 w-4" />
                  Sign in
                </Button>
              </Link>
              <Link href="/signup">
                <Button size="sm" className="gap-2">
                  <UserPlus className="h-4 w-4" />
                  Sign up
                </Button>
              </Link>
            </div>
          )}

          {/* User Info and Sign Out for Authenticated Users */}
          {isAuthenticated && (
            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-muted-foreground sm:inline">{userEmail}</span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={async () => {
                  setIsLoggingOut(true);
                  
                  try {
                    // Wait for logout to complete to ensure session is destroyed
                    await logoutWithoutRedirect();
                  } catch {
                    // If logout fails, still proceed (session might be invalid anyway)
                  } finally {
                    // Use hard navigation to ensure all state is cleared
                    window.location.href = "/";
                  }
                }}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing out...
                  </>
                ) : (
                  "Sign out"
                )}
              </Button>
            </div>
          )}

          {/* Mobile Menu Button for Public Pages */}
          {!isAuthenticated && (
            <button
              type="button"
              className="md:hidden inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              {...(sidebarOpen ? { "aria-expanded": true } : {})}
              aria-label="Toggle menu"
            >
              {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          )}
        </div>
      </nav>

      {/* Sidebar Navigation for Authenticated Users */}
      {isAuthenticated && (
        <>
          {/* Sidebar Panel */}
          <aside
            className={cn(
              "fixed left-0 top-16 h-[calc(100vh-4rem)] border-r border-border bg-card/95 backdrop-blur-md transition-all duration-300 ease-in-out z-[100]",
              // Desktop: always visible unless explicitly hidden
              "translate-x-0",
              // Desktop hidden state
              sidebarHidden && "-translate-x-full",
              // Desktop collapsed state (only when not hidden)
              !sidebarHidden && sidebarCollapsed ? "w-16" : "w-64"
            )}
            aria-label="Main navigation"
          >
            {/* Control Buttons */}
            <div className="absolute -right-3 top-4 z-[110] flex flex-col gap-2">
              {/* Collapse/Expand Button */}
              {!sidebarHidden && (
                <button
                  onClick={toggleSidebarCollapse}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background shadow-md transition-all hover:bg-accent hover:shadow-lg"
                  aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                  title={sidebarCollapsed ? "Expand sidebar" : "Collapse to icons"}
                >
                  <Menu className="h-4 w-4" />
                </button>
              )}
            </div>

            <nav className="h-full overflow-y-auto p-4">
              <div className="space-y-6">
                {navStructure.map((section, idx) => (
                  <div key={idx}>
                    {!sidebarCollapsed && (
                      <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {section.section}
                      </h3>
                    )}
                    <div className="space-y-1">
                      {section.items.map((item) => (
                        <Link
                          key={item.id || item.href}
                          href={item.href}
                          className={cn(
                            "relative z-10 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:bg-accent cursor-pointer",
                            isActive(item.href) 
                              ? "bg-primary/10 text-primary" 
                              : "text-muted-foreground hover:text-foreground",
                            item.variant === "destructive" && "hover:bg-destructive/10 hover:text-destructive",
                            sidebarCollapsed && "justify-center px-2"
                          )}
                          aria-current={isActive(item.href) ? "page" : undefined}
                          title={sidebarCollapsed ? item.label : undefined}
                        >
                          <item.icon className={cn("h-4 w-4 flex-shrink-0", sidebarCollapsed && "h-5 w-5")} />
                          <span className={cn(sidebarCollapsed && "hidden")}>{item.label}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* User Info in Sidebar */}
              {!sidebarCollapsed && (
                <div className="mt-6 border-t border-border pt-4">
                  <p className="px-3 text-xs text-muted-foreground truncate">{userEmail}</p>
                  <p className="px-3 text-xs font-medium text-primary capitalize">{userRole} Access</p>
                </div>
              )}
            </nav>
          </aside>

          {/* Floating Toggle Button (when sidebar is hidden) */}
          {sidebarHidden && (
            <button
              onClick={toggleSidebarHidden}
              className="fixed left-4 top-20 z-[100] flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background shadow-lg transition-all hover:bg-accent hover:shadow-xl"
              aria-label="Show sidebar"
              title="Show sidebar (Ctrl+B)"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </>
      )}

      {/* Mobile Menu for Public Pages */}
      {!isAuthenticated && sidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          
          <div className="fixed inset-x-0 top-16 z-50 mx-4 rounded-2xl border border-border bg-card/95 p-6 shadow-xl backdrop-blur-md md:hidden animate-in slide-in-from-top-5 fade-in-20">
            <nav className="space-y-4" role="navigation" aria-label="Mobile navigation">
              {publicNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => {
                    // #region agent log
                    fetch('http://127.0.0.1:7244/ingest/a101187a-72de-4f32-8b8f-fe2762640cce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'navigation.tsx:387',message:'Mobile Home link clicked',data:{href:item.href,pathname},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                    // #endregion
                  }}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-4 py-3 text-base font-medium transition-all hover:bg-accent",
                    isActive(item.href) 
                      ? "bg-primary/10 text-primary" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-current={isActive(item.href) ? "page" : undefined}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              ))}
              
              <div className="border-t border-border pt-4 space-y-2">
                <Link href="/login" className="block">
                  <Button variant="outline" className="w-full gap-2">
                    <LogIn className="h-4 w-4" />
                    Sign in
                  </Button>
                </Link>
                <Link href="/signup" className="block">
                  <Button className="w-full gap-2">
                    <UserPlus className="h-4 w-4" />
                    Sign up
                  </Button>
                </Link>
              </div>
            </nav>
          </div>
        </>
      )}
    </>
  );
}

