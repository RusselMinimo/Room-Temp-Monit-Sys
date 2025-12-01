import { Suspense } from "react";
import type { Metadata } from "next";

import { LiveReadings } from "@/components/iot/live-readings";
import { Navigation } from "@/components/ui/navigation";
import { DashboardLayout } from "@/components/ui/dashboard-layout";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { requireSession } from "@/lib/auth";
import { Activity } from "lucide-react";

export const metadata: Metadata = {
  title: "User Dashboard · IoT Room Monitoring",
  description: "Monitor live temperature, humidity, and device status from your IoT sensors.",
};

export const dynamic = "force-dynamic";

export default function UserDashboardPage() {
  const session = requireSession();

  return (
    <>
      <Navigation isAuthenticated={true} userEmail={session.email} userRole="user" />
      <DashboardLayout>
        <header className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-sm">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                  <p className="text-sm text-muted-foreground">
                    Welcome back, {session.email}
                  </p>
                </div>
              </div>
            </div>
          </header>

          <section className="space-y-6">
            {/* Live Readings Component */}
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold tracking-tight">Live Sensor Data</h2>
              <Suspense fallback={<DashboardSkeleton />}>
                <LiveReadings />
              </Suspense>
            </div>

            {/* Footer */}
            <footer className="mt-16 border-t border-border/40 py-8">
              <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
                <p className="text-sm text-muted-foreground">
                  © {new Date().getFullYear()} IoT Room Temperature. Real-time monitoring made simple.
                </p>
                <div className="flex items-center gap-4 text-sm">
                  <button className="text-muted-foreground transition-colors hover:text-foreground">
                    Help
                  </button>
                  <button className="text-muted-foreground transition-colors hover:text-foreground">
                    Documentation
                  </button>
                </div>
              </div>
            </footer>
          </section>
      </DashboardLayout>
    </>
  );
}
