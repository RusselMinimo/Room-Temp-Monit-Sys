import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";

import { requireAdminSession } from "@/lib/auth";
import { Navigation } from "@/components/ui/navigation";
import { DashboardLayout } from "@/components/ui/dashboard-layout";
import { BackToDashboardButton } from "@/components/admin/back-to-dashboard-button";

export const metadata: Metadata = {
  title: "Alert Configuration · IoT Room Monitoring",
  description: "Configure system alerts and notification settings.",
};

export const dynamic = "force-dynamic";

export default async function AlertConfigurationPage() {
  const session = await requireAdminSession();

  return (
    <>
      <Navigation isAuthenticated={true} userEmail={session.email} userRole="admin" />
      <DashboardLayout>
        <header className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-600 to-amber-400 text-white shadow-lg">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">Alert Configuration</h1>
                  <p className="text-sm text-muted-foreground">
                    Admin access for {session.email}
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground max-w-2xl">
                Configure alert thresholds, notification channels, and alert management rules.
              </p>
            </div>
            <BackToDashboardButton />
          </div>
        </header>

        <section className="space-y-6">
          <div className="rounded-xl border border-border/70 bg-card/80 p-6 shadow-sm backdrop-blur-sm">
            <p className="text-sm text-muted-foreground">
              Alert configuration coming soon. This page will allow you to set up and manage system alerts and notifications.
            </p>
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

