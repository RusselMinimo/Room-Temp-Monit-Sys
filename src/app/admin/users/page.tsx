import type { Metadata } from "next";
import { Users } from "lucide-react";

import { requireAdminSession } from "@/lib/auth";
import { Navigation } from "@/components/ui/navigation";
import { DashboardLayout } from "@/components/ui/dashboard-layout";
import { BackToDashboardButton } from "@/components/admin/back-to-dashboard-button";
import { UserManagementRealtime } from "@/components/admin/user-management-realtime";

export const metadata: Metadata = {
  title: "User Management · IoT Room Monitoring",
  description: "Manage users, roles, and permissions for your IoT dashboard.",
};

export const dynamic = "force-dynamic";

export default async function UserManagementPage() {
  const session = await requireAdminSession();

  return (
    <>
      <Navigation isAuthenticated={true} userEmail={session.email} userRole="admin" />
      <DashboardLayout>
        <header className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-400 text-white shadow-lg">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
                  <p className="text-sm text-muted-foreground">
                    Admin access for {session.email}
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground max-w-2xl">
                Manage user accounts, roles, and permissions. View user activity and manage access controls.
              </p>
            </div>
            <BackToDashboardButton />
          </div>
        </header>

        <section className="space-y-6">
          <UserManagementRealtime />

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

