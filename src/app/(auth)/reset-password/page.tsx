"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { AuthAlert, AuthCard, AuthSubmitButton, FieldError, PasswordField, RateLimitHint } from "@/components/auth/auth-ui";
import { Skeleton } from "@/components/ui/skeleton";

export default function ResetPasswordPage() {
  return (
    <React.Suspense fallback={<Skeleton className="h-64 w-full max-w-md rounded-2xl" />}>
      <ResetInner />
    </React.Suspense>
  );
}

function ResetInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const token = sp.get("token") ?? "";

  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [rateLimited, setRateLimited] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);

  // Never render the token anywhere; strip it from the URL once the page is shown.
  React.useEffect(() => {
    if (token) {
      const url = new URL(window.location.href);
      url.searchParams.delete("token");
      window.history.replaceState({}, "", url.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!token) {
    return (
      <AuthCard title="Invalid reset link" subtitle="No reset token was provided.">
        <div className="space-y-4 text-center">
          <p className="text-[13px] text-muted-foreground">
            Reset links are sent by email and expire after 30 minutes. Request a new one to continue.
          </p>
          <Link
            href="/forgot-password"
            className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring"
          >
            Request a new link
          </Link>
          <p className="text-xs text-muted-foreground">
            Or{" "}
            <Link href="/login" className="font-medium text-primary underline-offset-2 hover:underline">
              sign in
            </Link>
          </p>
        </div>
      </AuthCard>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setRateLimited(false);
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError("Password must be 8–72 characters with at least one letter and one number.");
      return;
    }
    if (confirm !== password) {
      setError("Passwords don't match.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await apiFetch("/api/auth/reset-password", {
        method: "POST",
        body: { token, password },
        skipAuthRedirect: true,
      });
      setDone(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't reset your password.";
      setServerError(msg);
      setRateLimited(/too many|try again/i.test(msg));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <AuthCard title="Password updated" subtitle="You can sign in with your new password.">
        <div className="space-y-4 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-success/15" aria-hidden>
            <CheckCircle2 className="size-6 text-success" />
          </span>
          <p className="text-[13px] text-muted-foreground">
            All existing sessions were signed out for your security. Sign in again to continue.
          </p>
          <button
            type="button"
            onClick={() => router.replace("/login")}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring"
          >
            Go to sign in
          </button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password" subtitle="Reset links expire after 30 minutes and can be used once.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <PasswordField
          id="reset-password"
          label="New password"
          value={password}
          autoComplete="new-password"
          autoFocus
          onChange={(v) => setPassword(v)}
        />
        <PasswordField
          id="reset-confirm"
          label="Confirm new password"
          value={confirm}
          autoComplete="new-password"
          onChange={(v) => setConfirm(v)}
        />
        <FieldError id="reset-error" message={error ?? undefined} />

        {serverError ? (
          <div className="space-y-2">
            <AuthAlert message={serverError} />
            {rateLimited ? <RateLimitHint /> : null}
          </div>
        ) : null}

        <AuthSubmitButton loading={busy}>Save new password</AuthSubmitButton>
        <p className="text-center text-xs text-muted-foreground">
          The reset token is used once — never shared or stored in the app.
        </p>
      </form>
    </AuthCard>
  );
}
