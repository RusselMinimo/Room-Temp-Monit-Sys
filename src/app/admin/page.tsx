import type { Metadata } from "next";
import { Shield } from "lucide-react";

import { listAuthLogs } from "@/lib/auth-logs";
import { requireAdminSession } from "@/lib/auth";
import { deleteAuthLogAction, clearAuthLogsAction } from "@/actions/admin-logs";
import { Navigation } from "@/components/ui/navigation";
import { DashboardLayout } from "@/components/ui/dashboard-layout";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { AuthLogsRealtime } from "@/components/admin/auth-logs-realtime";
import { BackToDashboardButton } from "@/components/admin/back-to-dashboard-button";

export const metadata: Metadata = {
  title: "Admin · Authentication Logs",
  description: "Monitor login, logout, and signup activity for your IoT dashboard.",
};

export const dynamic = "force-dynamic";

export default async function AdminLogsPage() {
  const session = await requireAdminSession();
  const logs = await listAuthLogs(200);
  
  async function handleDelete(formData: FormData) {
    "use server";
    await deleteAuthLogAction({}, formData);
  }

  return (
    <>
      <Navigation isAuthenticated={true} userEmail={session.email} userRole="admin" />
      <DashboardLayout>
        <header className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-purple-400 text-white shadow-lg">
                  <Shield className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">Authentication Logs</h1>
                  <p className="text-sm text-muted-foreground">
                    Admin access for {session.email}
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground max-w-2xl">
                Real-time monitoring of login, logout, and signup events. Track user authentication activity and security events.
              </p>
            </div>
            <BackToDashboardButton />
          </div>
          <div className="flex items-center gap-2">
            <ConfirmSubmit
              action={clearAuthLogsAction}
              message="Are you sure you want to clear all logs? This action cannot be undone."
              label="Clear all logs"
              variant="destructive"
              size="sm"
            />
          </div>
        </header>

        <section className="space-y-6">
          <AuthLogsRealtime initialLogs={logs} onDelete={handleDelete} />

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


