import type { Metadata } from "next";
import Link from "next/link";
import { Shield, Users, Activity, AlertTriangle, TrendingUp, Settings, LineChart, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Navigation } from "@/components/ui/navigation";
import { DashboardLayout } from "@/components/ui/dashboard-layout";
import { requireAdminSession, getActiveSessionCount } from "@/lib/auth";
import { getTotalUserCount } from "@/lib/users";
import { getActiveDeviceCount, getTotalDeviceCount } from "@/lib/store";
import { listActiveAlerts } from "@/lib/alerts";
import { isAdminUser } from "@/lib/users";

export const metadata: Metadata = {
  title: "Admin Dashboard · IoT Room Monitoring",
  description: "Administrator dashboard for managing IoT devices, users, and system settings.",
};

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const session = await requireAdminSession();
  const totalUsers = await getTotalUserCount();
  const activeDevices = getActiveDeviceCount(300000); // Active if sent data in last 5 minutes
  const totalDevices = getTotalDeviceCount();
  const offlineDevices = totalDevices - activeDevices;
  
  // Get active alerts from user devices only (exclude admin alerts)
  const allAlerts = listActiveAlerts();
  const userAlerts = allAlerts.filter(alert => {
    // Only count alerts that have a userEmail and that user is not an admin
    if (!alert.userEmail) return false;
    return !isAdminUser(alert.userEmail);
  });
  const activeAlertsCount = userAlerts.length;
  
  // Get active user sessions (logged-in users)
  const activeUserSessions = await getActiveSessionCount();

  return (
    <>
      <Navigation isAuthenticated={true} userEmail={session.email} userRole="admin" />
      <DashboardLayout>
        <header className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-purple-400 text-white shadow-lg">
                  <Shield className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">System Administration</h1>
                  <p className="text-sm text-muted-foreground">
                    Admin access for {session.email}
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground max-w-2xl">
                Comprehensive system overview and management tools for monitoring users, devices, and system health.
              </p>
            </div>
          </header>

          {/* System Overview Section */}
          <section className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
          <div className="group rounded-xl border border-border/70 bg-card/80 p-6 shadow-sm backdrop-blur-sm transition-all hover:scale-[1.02] hover:shadow-lg">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <h3 className="text-sm font-medium text-muted-foreground">Total Users</h3>
            </div>
            <p className="mt-3 text-3xl font-bold">{totalUsers}</p>
            <p className="mt-1 flex items-center gap-1 text-xs font-medium text-green-600">
              <TrendingUp className="h-3 w-3" />
              +12% from last month
            </p>
          </div>
          <div className="group rounded-xl border border-border/70 bg-card/80 p-6 shadow-sm backdrop-blur-sm transition-all hover:scale-[1.02] hover:shadow-lg">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <h3 className="text-sm font-medium text-muted-foreground">Active Devices</h3>
            </div>
            <p className="mt-3 text-3xl font-bold">{activeDevices}</p>
            <p className="mt-1 text-xs font-medium text-muted-foreground">
              {totalDevices === 0 
                ? "No devices" 
                : offlineDevices > 0 
                  ? `${offlineDevices} offline` 
                  : "All online"}
            </p>
          </div>
          <div className="group rounded-xl border border-border/70 bg-card/80 p-6 shadow-sm backdrop-blur-sm transition-all hover:scale-[1.02] hover:shadow-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <h3 className="text-sm font-medium text-muted-foreground">Active Alerts</h3>
            </div>
            <p className="mt-3 text-3xl font-bold">{activeAlertsCount}</p>
            {activeAlertsCount === 0 && (
              <p className="mt-1 text-xs font-medium text-muted-foreground">No active alerts</p>
            )}
          </div>
        </div>

            {/* Management Sections */}
            <div className="grid gap-6 lg:grid-cols-2">
          {/* User Management */}
          <div className="rounded-xl border border-border/70 bg-card/80 p-6 shadow-sm backdrop-blur-sm transition-all hover:shadow-lg">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <Users className="h-5 w-5 text-primary" />
              User Management
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-md bg-muted/50 p-3">
                <span className="text-sm">Total Registered Users</span>
                <span className="font-semibold">{totalUsers}</span>
              </div>
              <div className="flex items-center justify-between rounded-md bg-muted/50 p-3">
                <span className="text-sm">Active Sessions</span>
                <span className="font-semibold">{activeUserSessions}</span>
              </div>
              <div className="flex items-center justify-between rounded-md bg-muted/50 p-3">
                <span className="text-sm">Pending Approvals</span>
                <span className="font-semibold text-amber-600">5</span>
              </div>
            </div>
            <div className="mt-4">
              <Button asChild variant="secondary" size="sm">
                <Link href="/admin/users">
                  Manage Users
                </Link>
              </Button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="rounded-xl border border-border/70 bg-card/80 p-6 shadow-sm backdrop-blur-sm transition-all hover:shadow-lg">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <Settings className="h-5 w-5 text-primary" />
              Quick Actions
            </h2>
            <div className="space-y-3">
              <Button asChild variant="default" className="w-full justify-start gap-2" size="lg">
                <Link href="/admin-devicemonitoring">
                  <LineChart className="h-5 w-5" />
                  Device Monitoring
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start gap-2" size="lg">
                <Link href="/admin">
                  <FileText className="h-5 w-5" />
                  Authentication Logs
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start gap-2" size="lg">
                <Link href="/admin/users">
                  <Users className="h-5 w-5" />
                  User Management
                </Link>
              </Button>
            </div>
          </div>

            </div>

            {/* Recent Activity */}
            <div className="rounded-xl border border-border/70 bg-card/80 p-6 shadow-sm backdrop-blur-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Activity className="h-5 w-5 text-primary" />
            Recent System Activity
          </h2>
          <div className="space-y-2">
            <div className="flex items-center gap-3 rounded-md bg-muted/30 p-3">
              <span className="h-2 w-2 rounded-full bg-blue-500"></span>
              <span className="text-sm">New user registration: john.doe@example.com</span>
              <span className="ml-auto text-xs text-muted-foreground">2 minutes ago</span>
            </div>
            <div className="flex items-center gap-3 rounded-md bg-muted/30 p-3">
              <span className="h-2 w-2 rounded-full bg-green-500"></span>
              <span className="text-sm">Device ESP32-001 came online</span>
              <span className="ml-auto text-xs text-muted-foreground">5 minutes ago</span>
            </div>
            <div className="flex items-center gap-3 rounded-md bg-muted/30 p-3">
              <span className="h-2 w-2 rounded-full bg-amber-500"></span>
              <span className="text-sm">High temperature alert in Room 203</span>
              <span className="ml-auto text-xs text-muted-foreground">15 minutes ago</span>
            </div>
            <div className="flex items-center gap-3 rounded-md bg-muted/30 p-3">
              <span className="h-2 w-2 rounded-full bg-red-500"></span>
              <span className="text-sm">Device ESP32-005 went offline</span>
              <span className="ml-auto text-xs text-muted-foreground">1 hour ago</span>
            </div>
          </div>
            </div>

            {/* Footer */}
            <footer className="mt-8 border-t border-border/40 py-8">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  © {new Date().getFullYear()} IoT Room Temperature. Admin Portal.
                </p>
              </div>
            </footer>
          </section>
      </DashboardLayout>
    </>
  );
}
