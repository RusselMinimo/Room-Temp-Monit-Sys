"use client";

import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";

import { loginAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState = {
  error: "",
};

export function LoginForm() {
  const [state, formAction] = useFormState(loginAction, initialState);
  const hasError = Boolean(state?.error);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form 
      action={formAction} 
      className="w-full max-w-md space-y-6 rounded-2xl border border-border/70 bg-card/80 p-8 shadow-2xl backdrop-blur-md transition-shadow hover:shadow-3xl"
      noValidate
      aria-label="Sign in form"
    >
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Enter your credentials to access your dashboard
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium text-foreground">
          Email address
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? "login-error" : undefined}
          placeholder="Email address"
          className="transition-all focus:scale-[1.01]"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium text-foreground">
          Password
        </label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            minLength={8}
            aria-invalid={hasError || undefined}
            aria-describedby={hasError ? "login-error" : undefined}
            placeholder="••••••••"
            className="pr-10 transition-all focus:scale-[1.01]"
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {hasError && (
        <div 
          className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
          aria-live="assertive"
          id="login-error"
        >
          {state?.error}
        </div>
      )}

      <SubmitButton />

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        <span>or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full transition-all hover:scale-[1.02] active:scale-[0.98]"
        asChild
      >
        <a href="/api/auth/google" aria-label="Sign in with Google">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-sm bg-white shadow-sm">
            <svg
              viewBox="0 0 48 48"
              aria-hidden="true"
              className="h-4 w-4"
            >
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.2C12.43 13.02 17.74 9.5 24 9.5z"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.14-3.09-.39-4.55H24v9.02h12.94c-.56 2.89-2.24 5.34-4.78 6.98l7.73 6.01C44.7 38.18 46.98 31.87 46.98 24.55z"
              />
              <path
                fill="#FBBC05"
                d="M10.54 28.02A14.5 14.5 0 0 1 9.5 24c0-1.39.19-2.74.54-4.02l-7.98-6.2A23.92 23.92 0 0 0 0 24c0 3.89.93 7.56 2.56 10.8l7.98-6.78z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.9-5.83l-7.73-6.01C29.92 37.62 27.21 38.5 24 38.5c-6.26 0-11.57-3.52-13.46-8.52l-7.98 6.78C6.51 42.62 14.62 48 24 48z"
              />
              <path fill="none" d="M0 0h48v48H0z" />
            </svg>
          </span>
          <span>Sign in with Google</span>
        </a>
      </Button>

      <div className="space-y-3 pt-2 text-center text-sm text-muted-foreground">
        <p>
          Need an account?{" "}
          <Link href="/signup" className="font-medium text-primary transition-colors hover:text-primary/80">
            Sign up
          </Link>
        </p>
        <p>
          <Link href="/" className="font-medium text-primary transition-colors hover:text-primary/80">
            ← Back to home
          </Link>
        </p>
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button 
      type="submit" 
      className="w-full transition-all hover:scale-[1.02] active:scale-[0.98]" 
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? (
        <>
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Signing in…
        </>
      ) : (
        "Sign in"
      )}
    </Button>
  );
}

