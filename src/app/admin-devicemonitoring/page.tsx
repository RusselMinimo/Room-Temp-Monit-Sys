import { Suspense } from "react";
import type { Metadata } from "next";
import { LineChart, Activity } from "lucide-react";

import { Navigation } from "@/components/ui/navigation";
import { DashboardLayout } from "@/components/ui/dashboard-layout";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { requireAdminSession } from "@/lib/auth";
import { LiveReadings } from "@/components/iot/live-readings";
import { BackToDashboardButton } from "@/components/admin/back-to-dashboard-button";

export const metadata: Metadata = {
  title: "Device Monitoring · IoT Room Monitoring",
  description: "Monitor and manage IoT devices with live system data and device status.",
};

export const dynamic = "force-dynamic";

export default function DeviceMonitoringPage() {
  const session = requireAdminSession();

  return (
    <>
      <Navigation isAuthenticated={true} userEmail={session.email} userRole="admin" />
      <DashboardLayout>
        <header className="space-y-6 relative z-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-400 text-white shadow-lg">
                  <LineChart className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">Device Monitoring</h1>
                  <p className="text-sm text-muted-foreground">
                    Admin access for {session.email}
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground max-w-2xl">
                Monitor real-time device status, temperature, humidity, and system health across all IoT devices.
              </p>
            </div>
            <div className="relative z-20">
              <BackToDashboardButton />
            </div>
          </div>
        </header>

        <section className="space-y-6">
          {/* Live System Data Section */}
          <div className="space-y-4">
            <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <Activity className="h-6 w-6 text-primary" />
              Live System Data
            </h2>
            <Suspense fallback={<DashboardSkeleton />}>
              <LiveReadings />
            </Suspense>
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

