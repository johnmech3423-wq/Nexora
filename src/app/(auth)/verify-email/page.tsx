"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, MailCheck, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { AuthAlert, AuthCard, RateLimitHint } from "@/components/auth/auth-ui";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function VerifyEmailPage() {
  return (
    <React.Suspense fallback={<Skeleton className="h-64 w-full max-w-md rounded-2xl" />}>
      <VerifyInner />
    </React.Suspense>
  );
}

type Status = "idle" | "verifying" | "success" | "error";

function VerifyInner() {
  const sp = useSearchParams();
  const token = sp.get("token") ?? "";

  const [status, setStatus] = React.useState<Status>(token ? "verifying" : "idle");
  const [message, setMessage] = React.useState<string | null>(null);
  const [resent, setResent] = React.useState(false);
  const [resendBusy, setResendBusy] = React.useState(false);
  const [resendError, setResendError] = React.useState<string | null>(null);
  const [rateLimited, setRateLimited] = React.useState(false);

  const meQ = useQuery({
    queryKey: ["auth-session-check"],
    queryFn: () => apiFetch<{ user: { emailVerified: boolean } }>("/api/auth/me", { skipAuthRedirect: true }),
    retry: false,
    staleTime: 0,
  });

  React.useEffect(() => {
    let alive = true;
    if (!token) return undefined;
    (async () => {
      try {
        await apiFetch("/api/auth/verify-email", {
          method: "POST",
          body: { token },
          skipAuthRedirect: true,
        });
        if (alive) {
          setStatus("success");
          void meQ.refetch();
        }
      } catch (e) {
        if (alive) {
          setStatus("error");
          setMessage(e instanceof Error ? e.message : "This verification link didn't work.");
          setRateLimited(/too many|try again/i.test(e instanceof Error ? e.message : ""));
        }
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const resend = async () => {
    setResendBusy(true);
    setResendError(null);
    try {
      await apiFetch("/api/auth/resend-verification", { method: "POST", skipAuthRedirect: true });
      setResent(true);
      toast.success("Verification email sent");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't resend the email.";
      setResendError(msg);
      if (/too many|try again/i.test(msg)) setRateLimited(true);
      if (/session|sign in/i.test(msg)) setResendError(`${msg} — please sign in first.`);
    } finally {
      setResendBusy(false);
    }
  };

  const signedIn = Boolean(meQ.data);
  const alreadyVerified = Boolean(meQ.data?.user.emailVerified);

  if (status === "verifying") {
    return (
      <AuthCard title="Verifying your email" subtitle="One moment…">
        <div className="space-y-3 text-center">
          <Loader2 className="mx-auto size-8 animate-spin text-primary" aria-hidden />
          <p className="text-[13px] text-muted-foreground">Checking your verification link.</p>
        </div>
      </AuthCard>
    );
  }

  if (status === "success") {
    return (
      <AuthCard title="Email verified" subtitle="Your account email is confirmed.">
        <div className="space-y-4 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-success/15" aria-hidden>
            <CheckCircle2 className="size-6 text-success" />
          </span>
          <p className="text-[13px] text-muted-foreground">
            You can now use every account feature that requires a verified address.
          </p>
          <Link href="/dashboard" className={cn(buttonVariants({ size: "lg" }), "w-full")}>
            Continue to dashboard
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={token ? "Verification link issue" : "Verify your email"}
      subtitle={
        token
          ? "We couldn't complete verification with that link."
          : signedIn && alreadyVerified
            ? "Your email is already verified — nothing to do."
            : "We sent you a verification email — open the link inside it."
      }
    >
      <div className="space-y-4">
        {message && status === "error" ? (
          <div className="space-y-2">
            <AuthAlert message={message} />
            {rateLimited ? <RateLimitHint /> : null}
          </div>
        ) : null}

        <div className="rounded-lg border bg-muted/30 p-3.5 text-[13px] text-muted-foreground">
          <p className="flex items-start gap-2">
            <MailCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <span>
              Verification links are valid for 24 hours and can be used once. Check your inbox (and spam) for an email from
              Nexora, then click the link inside it.
            </span>
          </p>
        </div>

        {signedIn && !alreadyVerified ? (
          <div className="space-y-2">
            <Button variant="outline" className="w-full" onClick={() => void resend()} disabled={resendBusy || resent}>
              {resendBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
              {resent ? "Verification email sent — check your inbox" : "Resend verification email"}
            </Button>
            {resendError ? <AuthAlert message={resendError} /> : null}
            <p className="text-center text-xs text-muted-foreground">
              Resending is limited to 3 per hour per account.
            </p>
          </div>
        ) : !signedIn ? (
          <div className="space-y-2 text-center">
            <p className="text-[13px] text-muted-foreground">Need to resend the email? Sign in first.</p>
            <Link href="/login" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
              Sign in
            </Link>
          </div>
        ) : null}

        {signedIn ? (
          <div className="text-center">
            <Link href="/dashboard" className="text-xs font-medium text-primary underline-offset-2 hover:underline">
              Go to dashboard
            </Link>
          </div>
        ) : null}
      </div>
    </AuthCard>
  );
}
