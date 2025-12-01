"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { appendAuthLog } from "@/lib/auth-logs";
import { createSession, destroySession, getSession, verifyUserCredentials } from "@/lib/auth";
import { createUser } from "@/lib/users";

interface AuthState {
  error?: string;
  success?: boolean;
}

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const signupSchema = loginSchema
  .extend({
    confirmPassword: z.string().min(8, "Password must be at least 8 characters"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords must match",
    path: ["confirmPassword"],
  });

function buildErrorState(error: unknown): AuthState {
  if (typeof error === "string") return { error };
  if (error instanceof Error) return { error: error.message };
  return { error: "Something went wrong. Please try again." };
}

function getClientInfo() {
  const hdrs = headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const userAgent = hdrs.get("user-agent") ?? "unknown";
  return { ip, userAgent };
}

export async function loginAction(_state: AuthState, formData: FormData): Promise<AuthState> {
  const clientInfo = getClientInfo();
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const attemptedEmail = String(formData.get("email") ?? "unknown");
    appendAuthLog({
      email: attemptedEmail,
      event: "login_failure",
      details: parsed.error.issues[0]?.message ?? "Invalid form input",
      ...clientInfo,
    });
    return { error: parsed.error.issues[0]?.message ?? "Invalid credentials" };
  }

  const { email, password } = parsed.data;
  const isValid = await verifyUserCredentials(email, password);
  if (!isValid) {
    appendAuthLog({ email, event: "login_failure", ...clientInfo });
    return { error: "Invalid email or password" };
  }

  await createSession(email);
  appendAuthLog({ email, event: "login_success", ...clientInfo });
  
  // Redirect based on user role
  const { isAdminUser } = await import("@/lib/users");
  const isAdmin = isAdminUser(email);
  redirect(isAdmin ? "/admin-dashboard" : "/user-dashboard");
}

export async function signupAction(_state: AuthState, formData: FormData): Promise<AuthState> {
  const clientInfo = getClientInfo();
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { email, password } = parsed.data;

  try {
    createUser(email, password);
    appendAuthLog({ email, event: "signup", ...clientInfo });
  } catch (error) {
    return buildErrorState(error);
  }

	return { success: true };
}

export async function logoutAction() {
  const session = getSession();
  
  // Destroy session first for instant logout
  destroySession();
  
  // Log asynchronously without blocking (fire and forget)
  if (session) {
    Promise.resolve().then(() => {
      appendAuthLog({ email: session.email, event: "logout", ...getClientInfo() });
    }).catch(() => {
      // Silently ignore logging errors
    });
  }
  
  redirect("/");
}

// Client-safe logout that doesn't redirect (for use with client-side routing)
export async function logoutWithoutRedirect() {
  const session = getSession();
  
  // Destroy session first for instant logout
  destroySession();
  
  // Log asynchronously without blocking (fire and forget)
  if (session) {
    Promise.resolve().then(() => {
      appendAuthLog({ email: session.email, event: "logout", ...getClientInfo() });
    }).catch(() => {
      // Silently ignore logging errors
    });
  }
}


