import type { Metadata } from "next";
import { Database } from "lucide-react";

import { requireAdminSession } from "@/lib/auth";
import { Navigation } from "@/components/ui/navigation";
import { DashboardLayout } from "@/components/ui/dashboard-layout";
import { BackToDashboardButton } from "@/components/admin/back-to-dashboard-button";

export const metadata: Metadata = {
  title: "Backup Data · IoT Room Monitoring",
  description: "Backup and restore system data and configurations.",
};

export const dynamic = "force-dynamic";

export default async function BackupDataPage() {
  const session = await requireAdminSession();

  return (
    <>
      <Navigation isAuthenticated={true} userEmail={session.email} userRole="admin" />
      <DashboardLayout>
        <header className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-400 text-white shadow-lg">
                  <Database className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">Backup Data</h1>
                  <p className="text-sm text-muted-foreground">
                    Admin access for {session.email}
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground max-w-2xl">
                Create backups of system data, configurations, and restore from previous backups.
              </p>
            </div>
            <BackToDashboardButton />
          </div>
        </header>

        <section className="space-y-6">
          <div className="rounded-xl border border-border/70 bg-card/80 p-6 shadow-sm backdrop-blur-sm">
            <p className="text-sm text-muted-foreground">
              Backup and restore functionality coming soon. This page will allow you to create and manage system backups.
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

