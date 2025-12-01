"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";

import { signupAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState = { error: "" };

export function SignupForm() {
  const router = useRouter();
  const [state, formAction] = useFormState(signupAction, initialState);
  const hasError = Boolean(state?.error);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (state?.success) {
			router.push("/signup/success");
    }
  }, [state?.success, router]);

  return (
    <form 
      action={formAction} 
      className="w-full max-w-md space-y-6 rounded-2xl border border-border/70 bg-card/80 p-8 shadow-2xl backdrop-blur-md transition-shadow hover:shadow-3xl"
      noValidate
      aria-label="Sign up form"
    >
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Create account</h1>
        <p className="text-sm text-muted-foreground">Get started with your IoT monitoring dashboard</p>
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
          placeholder="you@example.com"
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? "form-error" : undefined}
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
            autoComplete="new-password"
            required
            minLength={8}
            aria-invalid={hasError || undefined}
            aria-describedby={hasError ? "form-error" : "password-requirements"}
            placeholder="Create a strong password"
            className="pr-11 transition-all focus:scale-[1.01]"
          />
          <button
            type="button"
            className="absolute inset-y-0 right-2 inline-flex items-center rounded-md px-2 text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            tabIndex={0}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p id="password-requirements" className="text-xs text-muted-foreground">
          Minimum 8 characters required
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
          Confirm Password
        </label>
        <div className="relative">
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={8}
            aria-invalid={hasError || undefined}
            aria-describedby={hasError ? "form-error" : undefined}
            placeholder="Re-enter password"
            className="pr-11 transition-all focus:scale-[1.01]"
          />
          <button
            type="button"
            className="absolute inset-y-0 right-2 inline-flex items-center rounded-md px-2 text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            onClick={() => setShowConfirmPassword((prev) => !prev)}
            aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
            tabIndex={0}
          >
            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {hasError && (
        <div 
          className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
          aria-live="assertive"
          id="form-error"
        >
          {state?.error}
        </div>
      )}

      <SubmitButton />

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary transition-colors hover:text-primary/80">
          Sign in
        </Link>
      </p>
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
          Creating account…
        </>
      ) : (
        "Create account"
      )}
    </Button>
  );
}


