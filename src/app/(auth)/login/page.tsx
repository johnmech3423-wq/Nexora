"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { safeNext } from "@/lib/safe-next";
import { AuthAlert, AuthCard, AuthSubmitButton, PasswordField, goAfterAuth, RateLimitHint } from "@/components/auth/auth-ui";
import { Checkbox } from "@/components/ui/controls";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";

export default function LoginPage() {
  return (
    <React.Suspense fallback={<AuthLoadingSkeleton />}>
      <LoginInner />
    </React.Suspense>
  );
}

function AuthLoadingSkeleton() {
  return (
    <div className="w-full max-w-md space-y-4" aria-busy>
      <Skeleton className="mx-auto h-8 w-48" />
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="mt-4 h-10 w-full" />
        <Skeleton className="mt-6 h-11 w-full" />
      </div>
    </div>
  );
}

function LoginInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next");

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [remember, setRemember] = React.useState(false);
  const [clientError, setClientError] = React.useState<string | null>(null);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [rateLimited, setRateLimited] = React.useState(false);

  const [phase, setPhase] = React.useState<"creds" | "2fa">("creds");
  const [challenge, setChallenge] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState<"creds" | "2fa" | null>(null);

  // Bounce authenticated visitors away (they should be in the app already).
  const meQ = useQuery({
    queryKey: ["auth-session-check"],
    queryFn: () => apiFetch<{ user: { id: string } }>("/api/auth/me", { skipAuthRedirect: true }),
    retry: false,
    staleTime: 0,
  });
  React.useEffect(() => {
    if (meQ.data && !meQ.isFetching) {
      router.replace(safeNext(next) || "/dashboard");
    }
  }, [meQ.data, meQ.isFetching, router, next]);

  const submitCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setRateLimited(false);
    const emailTrim = email.trim().toLowerCase();
    if (!emailTrim) {
      setClientError("Enter your email address.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      setClientError("Enter a valid email address.");
      return;
    }
    if (!password) {
      setClientError("Enter your password.");
      return;
    }
    setClientError(null);
    setBusy("creds");
    try {
      const data = await apiFetch<{ needsTwoFactor: boolean; challenge?: string }>("/api/auth/login", {
        method: "POST",
        body: { email: emailTrim, password, remember },
        skipAuthRedirect: true,
      });
      if (data.needsTwoFactor && data.challenge) {
        setChallenge(data.challenge);
        setCode("");
        setPhase("2fa");
        setBusy(null);
        return;
      }
      await goAfterAuth(next, router);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't sign in.";
      setServerError(msg);
      setRateLimited(/too many|try again/i.test(msg));
      setBusy(null);
    }
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    if (!challenge) {
      setPhase("creds");
      return;
    }
    if (code.trim().length < 6) {
      setClientError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    if (code.trim().length > 10) {
      setClientError("Codes are 6 to 10 digits.");
      return;
    }
    setClientError(null);
    setBusy("2fa");
    try {
      await apiFetch("/api/auth/two-factor/verify", {
        method: "POST",
        body: { code: code.trim(), challenge },
        skipAuthRedirect: true,
      });
      await goAfterAuth(next, router);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "That code didn't work.";
      setServerError(msg);
      setRateLimited(/too many|try again/i.test(msg));
      // 400/422 = the challenge itself is dead or malformed → start over with credentials.
      // 401 = just a wrong code → stay on the 2FA step and let the user retry.
      if (e instanceof ApiClientError && (e.status === 400 || e.status === 422)) {
        setPhase("creds");
        setChallenge(null);
      }
      setBusy(null);
    }
  };

  const restart = () => {
    setPhase("creds");
    setChallenge(null);
    setCode("");
    setServerError(null);
  };

  if (phase === "2fa" && challenge) {
    return (
      <AuthCard title="Two-factor authentication" subtitle="Enter the code from your authenticator app to finish signing in.">
        <form onSubmit={submitCode} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="login-2fa">6-digit code</Label>
            <Input
              id="login-2fa"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="123456"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              aria-describedby="login-2fa-hint"
              className="font-mono text-center text-lg tracking-[0.4em]"
            />
            <p id="login-2fa-hint" className="text-xs text-muted-foreground">
              The code refreshes every 30 seconds. Codes are valid for 10 minutes.
            </p>
          </div>

          {clientError ? <AuthAlert message={clientError} /> : null}
          {serverError ? (
            <div className="space-y-2">
              <AuthAlert message={serverError} />
              {rateLimited ? <RateLimitHint /> : null}
            </div>
          ) : null}

          <AuthSubmitButton loading={busy === "2fa"}>Verify and sign in</AuthSubmitButton>
          <div className="flex justify-center">
            <button
              type="button"
              onClick={restart}
              className="rounded px-1 py-0.5 text-xs text-muted-foreground underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              Use a different account
            </button>
          </div>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Welcome back" subtitle="Sign in to your Nexora account.">
      <form onSubmit={submitCredentials} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="login-email">Email</Label>
          <Input
            id="login-email"
            type="email"
            value={email}
            autoComplete="email"
            autoFocus
            placeholder="you@company.com"
            onChange={(e) => {
              setEmail(e.target.value);
              setClientError(null);
            }}
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="login-password">Password</Label>
            <Link
              href="/forgot-password"
              className="rounded px-1 py-0.5 text-xs font-medium text-primary underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              Forgot password?
            </Link>
          </div>
          <PasswordField
            id="login-password"
            label=""
            value={password}
            autoComplete="current-password"
            onChange={(v) => {
              setPassword(v);
              setClientError(null);
            }}
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2.5 text-[13px]">
          <Checkbox checked={remember} onCheckedChange={(c) => setRemember(c !== false)} />
          <span>
            Keep me signed in for 30 days
            <span className="block text-xs text-muted-foreground">Otherwise you&apos;re signed out after 7 days.</span>
          </span>
        </label>

        {clientError ? <AuthAlert message={clientError} /> : null}
        {serverError ? (
          <div className="space-y-2">
            <AuthAlert message={serverError} />
            {rateLimited ? <RateLimitHint /> : null}
          </div>
        ) : null}

        <AuthSubmitButton loading={busy === "creds"}>Sign in</AuthSubmitButton>
      </form>
      <p className="mt-5 border-t pt-4 text-center text-[13px] text-muted-foreground">
        New to Nexora?{" "}
        <Link href={safeNext(next) ? `/register?next=${encodeURIComponent(safeNext(next))}` : "/register"} className="font-medium text-primary underline-offset-2 hover:underline">
          Create an account
        </Link>
      </p>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Sessions are protected with secure cookies and, optionally, two-factor authentication.
      </p>
    </AuthCard>
  );
}
