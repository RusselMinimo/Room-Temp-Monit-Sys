import type { Metadata } from "next";
import { Bell } from "lucide-react";

import { requireSession } from "@/lib/auth";
import { Navigation } from "@/components/ui/navigation";
import { DashboardLayout } from "@/components/ui/dashboard-layout";

export const metadata: Metadata = {
  title: "Alerts · IoT Room Monitoring",
  description: "View and manage your alerts and notifications.",
};

export const dynamic = "force-dynamic";

export default function AlertsPage() {
  const session = requireSession();

  return (
    <>
      <Navigation isAuthenticated={true} userEmail={session.email} userRole="user" />
      <DashboardLayout>
        <header className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-sm">
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Alerts</h1>
                <p className="text-sm text-muted-foreground">
                  Welcome back, {session.email}
                </p>
              </div>
            </div>
          </div>
        </header>

        <section className="space-y-6">
          <div className="rounded-xl border border-border/70 bg-card/80 p-6 shadow-sm backdrop-blur-sm">
            <p className="text-sm text-muted-foreground">
              Alert management coming soon. This page will allow you to view and manage your alerts and notifications.
            </p>
          </div>

          {/* Footer */}
          <footer className="mt-16 border-t border-border/40 py-8">
            <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
              <p className="text-sm text-muted-foreground">
                © {new Date().getFullYear()} IoT Room Temperature. Real-time monitoring made simple.
              </p>
            </div>
          </footer>
        </section>
      </DashboardLayout>
    </>
  );
}

