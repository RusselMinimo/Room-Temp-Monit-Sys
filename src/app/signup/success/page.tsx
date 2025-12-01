import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { getSession, isAdminEmail } from "@/lib/auth";

export const metadata: Metadata = {
	title: "Account created | IoT Room Temperature",
};

export default function SignupSuccessPage() {
	const session = getSession();
	if (session) {
		const isAdmin = isAdminEmail(session.email);
		redirect(isAdmin ? "/admin-dashboard" : "/user-dashboard");
	}

	return (
		<main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center gap-6 px-4 py-12 text-center">
			<div className="space-y-2">
				<h1 className="text-3xl font-semibold tracking-tight">Account successfully created</h1>
				<p className="text-sm text-muted-foreground">
					Your account is ready. For security, please sign in with your new credentials to continue.
				</p>
			</div>
			<div>
				<Button asChild>
					<Link href="/login">Go to Sign In</Link>
				</Button>
			</div>
		</main>
	);
}


