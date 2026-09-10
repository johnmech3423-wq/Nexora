"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { MailCheck } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { AuthAlert, AuthCard, AuthSubmitButton, FieldError, RateLimitHint } from "@/components/auth/auth-ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/field";

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [rateLimited, setRateLimited] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  // Auth check purely to decide whether to show a “back to dashboard” link.
  const meQ = useQuery({
    queryKey: ["auth-session-check"],
    queryFn: () => apiFetch<{ user: { id: string } }>("/api/auth/me", { skipAuthRedirect: true }),
    retry: false,
    staleTime: 0,
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setRateLimited(false);
    const emailTrim = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await apiFetch("/api/auth/forgot-password", {
        method: "POST",
        body: { email: emailTrim },
        skipAuthRedirect: true,
      });
      setSent(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't send the reset email.";
      setServerError(msg);
      setRateLimited(/too many|try again/i.test(msg));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <AuthCard title="Check your inbox" subtitle="Password reset email sent.">
        <div className="space-y-4 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-success/15" aria-hidden>
            <MailCheck className="size-6 text-success" />
          </span>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            If an account exists for <span className="font-medium text-foreground">{email.trim().toLowerCase()}</span>, you&apos;ll
            receive an email with a link to reset your password. The link expires after 30 minutes.
          </p>
          <p className="text-xs text-muted-foreground">
            No email? Check spam, or wait a moment and request again (limited per account).{" "}
            <button
              type="button"
              onClick={() => setSent(false)}
              className="font-medium text-primary underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              Try another address
            </button>
          </p>
          <Link
            href="/login"
            className="inline-block rounded px-1 py-0.5 text-sm font-medium text-primary underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            Back to sign in
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Reset your password" subtitle="Enter your email and we&apos;ll send you a reset link.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="forgot-email">Email</Label>
          <Input
            id="forgot-email"
            type="email"
            value={email}
            autoComplete="email"
            autoFocus
            placeholder="you@company.com"
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
          />
          <FieldError id="forgot-email-error" message={error ?? undefined} />
        </div>

        {serverError ? (
          <div className="space-y-2">
            <AuthAlert message={serverError} />
            {rateLimited ? <RateLimitHint /> : null}
          </div>
        ) : null}

        <AuthSubmitButton loading={busy}>Send reset link</AuthSubmitButton>
        <div className="space-y-1 text-center">
          <p className="text-[13px] text-muted-foreground">
            Remembered it?{" "}
            <Link href="/login" className="font-medium text-primary underline-offset-2 hover:underline">
              Sign in
            </Link>
          </p>
          {meQ.data ? (
            <p className="text-xs text-muted-foreground">
              Signed in?{" "}
              <Link href="/settings/security" className="font-medium text-primary underline-offset-2 hover:underline">
                Change password in settings
              </Link>
            </p>
          ) : null}
        </div>
      </form>
    </AuthCard>
  );
}
