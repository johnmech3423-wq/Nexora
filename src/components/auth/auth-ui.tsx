"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { safeNext } from "@/lib/safe-next";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/field";
import { Loader2 } from "lucide-react";
import type { OrgOption } from "@/lib/org-store";

/* --------------------------- Shared auth card ------------------------ */

export function AuthCard({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("w-full max-w-md space-y-5", className)}>
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-7">{children}</div>
    </div>
  );
}

export function AuthAlert({ message, id }: { message: string; id?: string }) {
  return (
    <p
      id={id}
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-[13px] text-destructive"
    >
      <span aria-hidden className="mt-0.5">⚠</span>
      <span className="min-w-0 flex-1">{message}</span>
    </p>
  );
}

export function RateLimitHint() {
  return (
    <p className="text-xs text-muted-foreground">
      Too many attempts? Security limits apply per account and device — wait a few minutes before trying again.
    </p>
  );
}

/* --------------------------- Password field -------------------------- */

export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  autoFocus,
  placeholder,
  error,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: "current-password" | "new-password";
  autoFocus?: boolean;
  placeholder?: string;
  error?: string;
  hint?: React.ReactNode;
}) {
  const [show, setShow] = React.useState(false);
  return (
    <div className="space-y-1.5">
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          onChange={(e) => onChange(e.target.value)}
          className="pr-10"
        />
        <button
          type="button"
          aria-label={show ? "Hide password" : "Show password"}
          onClick={() => setShow((s) => !s)}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <div id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-xs text-destructive">
      {message}
    </p>
  );
}

/* ---------------------- Post-auth destination ------------------------ */

/**
 * Resolves where a freshly signed-in user should land:
 * - zero organizations → onboarding (first-run)
 * - otherwise → sanitized ?next= destination or the dashboard.
 */
export async function goAfterAuth(next: string | null, router: ReturnType<typeof useRouter>): Promise<void> {
  let orgs: OrgOption[] = [];
  try {
    const data = await apiFetch<{ organizations: OrgOption[] }>("/api/organizations", { skipAuthRedirect: true });
    orgs = data.organizations;
  } catch {
    // Organization fetch failed (network etc.) — still continue to a safe destination.
  }
  if (orgs.length === 0) {
    router.replace("/onboarding");
    return;
  }
  router.replace(safeNext(next) || "/dashboard");
}

/** Busy-state submit button used across auth forms. */
export function AuthSubmitButton({
  loading,
  children,
  className,
}: {
  loading: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Button type="submit" size="lg" className={cn("w-full", className)} disabled={loading}>
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {children}
    </Button>
  );
}
