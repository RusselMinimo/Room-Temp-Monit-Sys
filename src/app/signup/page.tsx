import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignupForm } from "@/components/auth/signup-form";
import { Navigation } from "@/components/ui/navigation";
import { getSession, isAdminEmail } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Sign up | IoT Room Temperature",
  description: "Create an account to access the IoT room monitoring dashboard.",
};

export default function SignupPage() {
  const session = getSession();
  if (session) {
    const isAdmin = isAdminEmail(session.email);
    redirect(isAdmin ? "/admin-dashboard" : "/user-dashboard");
  }

  return (
    <>
      <Navigation isAuthenticated={false} />
      <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col items-center justify-center gap-10 px-4 py-12 sm:px-6 lg:flex-row lg:items-stretch lg:gap-16">
      <section className="max-w-xl space-y-6 text-center lg:text-left">
        <p className="inline-flex items-center rounded-full border border-border px-4 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          New workspace
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">Sign up and start streaming your room telemetry</h1>
        <p className="text-base text-muted-foreground">
          Accounts are stored securely on the server and authenticated with HTTP-only cookies. You can still keep the fallback admin credentials in <span className="font-mono text-xs">.env.local</span> for maintenance access.
        </p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• Salty SHA-256 hashes generated on the fly</li>
          <li>• Sessions expire after eight hours of inactivity</li>
          <li>• Logout instantly revokes tokens</li>
        </ul>
      </section>
      <SignupForm />
    </main>
    </>
  );
}


