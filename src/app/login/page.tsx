import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { Navigation } from "@/components/ui/navigation";
import { getSession, isAdminEmail } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Sign in | IoT Room Temperature",
  description: "Authenticate to access the live IoT dashboard.",
};

export default async function LoginPage() {
  const session = await getSession();
  if (session) {
    const isAdmin = isAdminEmail(session.email);
    redirect(isAdmin ? "/admin-dashboard" : "/user-dashboard");
  }

  return (
    <>
      <Navigation isAuthenticated={false} />
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-7xl flex-col items-center justify-center gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:items-stretch lg:gap-12">
      <section className="max-w-xl space-y-6 text-center lg:text-left">
        <p className="inline-flex items-center rounded-full border border-border px-4 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Secure gateway
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">Log in to manage your IoT room telemetry</h1>
        <p className="text-base text-muted-foreground">
          We validate credentials server-side, issue an HTTP-only session cookie, and guard all dashboard routes. Your readings stay private, yet accessible from any device connected to your Wi-Fi network.
        </p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• Credential hashing with constant-time checks</li>
          <li>• Eight-hour rolling sessions with idle expiry</li>
          <li>• Logout instantly revokes the session token</li>
        </ul>
      </section>
      <LoginForm />
    </main>
    </>
  );
}


