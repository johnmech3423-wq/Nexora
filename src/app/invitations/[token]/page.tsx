"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AlertCircle, Building2, Check, Clock, Mail, ShieldCheck, X } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { ORG_ROLE_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import { apiErrorMessage } from "@/components/features/error-handling";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface Preview {
  organizationName: string;
  inviterName: string;
  email: string;
  role: "owner" | "admin" | "member" | "guest";
  expiresAt: string;
  status: "pending";
  memberAlready: boolean;
  hasAccount: boolean;
}

type Screen = "loading" | "ready" | "accepting" | "declining" | "accepted" | "declined" | "error";

export default function InvitationLandingPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = params.token;
  const [screen, setScreen] = React.useState<Screen>("loading");
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = React.useState(false);
  const [result, setResult] = React.useState<string | null>(null);

  const run = React.useCallback(
    async (action: "accept" | "decline") => {
      setScreen(action === "accept" ? "accepting" : "declining");
      setErrorMessage(null);
      try {
        if (action === "accept") {
          const data = await apiFetch<{ organizationName: string; role: string }>(
            `/api/invitations/${token}/${action}`,
            { method: "POST" }
          );
          setScreen("accepted");
          setResult(`You're now a member of ${data.organizationName} (${ORG_ROLE_LABELS[data.role as Preview["role"]] ?? data.role}).`);
          toast.success("Invitation accepted");
        } else {
          await apiFetch(`/api/invitations/${token}/decline`, { method: "POST" });
          setScreen("declined");
          toast.success("Invitation declined");
        }
      } catch (e) {
        const msg = apiErrorMessage(e, "Something went wrong.");
        if (/sign in|signed in|unauthorized/i.test(msg)) {
          setNeedsSignIn(true);
          setScreen("ready");
        } else {
          setScreen("error");
        }
        setErrorMessage(msg);
      }
    },
    [token]
  );

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<{ invitation: Preview }>(`/api/invitations/${token}`);
        if (!cancelled) {
          setPreview(data.invitation);
          setScreen("ready");
        }
      } catch (e) {
        if (!cancelled) {
          setErrorMessage(apiErrorMessage(e, "This invitation link is invalid."));
          setScreen("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const roleLabel = preview ? ORG_ROLE_LABELS[preview.role] ?? preview.role : "";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground" aria-hidden>
            <Building2 className="size-4" />
          </span>
          Nexora
        </div>

        {screen === "loading" ? (
          <div className="mt-6 space-y-3" aria-busy>
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-1/2" />
          </div>
        ) : screen === "error" && !preview ? (
          <div className="mt-6 space-y-4 text-center" role="alert">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="size-6 text-destructive" />
            </span>
            <div>
              <h1 className="text-lg font-semibold">Invitation unavailable</h1>
              <p className="mt-1 text-sm text-muted-foreground">{errorMessage}</p>
            </div>
            <p className="text-[13px] text-muted-foreground">
              Invitations expire after 7 days and can only be used once. Ask the person who invited you to send a new one.
            </p>
          </div>
        ) : preview && (screen === "ready" || screen === "accepting" || screen === "declining") ? (
          <div className="mt-6">
            <div className="flex items-center gap-4">
              <Avatar name={preview.organizationName} size="xl" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">You&apos;ve been invited to</p>
                <h1 className="truncate text-lg font-semibold">{preview.organizationName}</h1>
                <p className="text-[13px] text-muted-foreground">by {preview.inviterName}</p>
              </div>
            </div>

            <dl className="mt-5 space-y-2 rounded-lg bg-muted/40 p-3 text-[13px]">
              <div className="flex justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <Mail className="size-3.5" /> Invited email
                </dt>
                <dd className="truncate font-medium">{preview.email}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <ShieldCheck className="size-3.5" /> Role
                </dt>
                <dd>
                  <Badge variant="secondary" className="capitalize">{roleLabel}</Badge>
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="size-3.5" /> Expires
                </dt>
                <dd>{formatDateTime(preview.expiresAt)}</dd>
              </div>
            </dl>

            {preview.memberAlready ? (
              <div className="mt-5 space-y-3">
                <p className="text-sm">
                  You&apos;re already a member of <span className="font-medium">{preview.organizationName}</span>. Nothing to do.
                </p>
                <Button className="w-full" onClick={() => router.push("/dashboard")}>
                  Go to my dashboard
                </Button>
              </div>
            ) : !preview.hasAccount ? (
              <div className="mt-5 space-y-3">
                <p className="text-sm">
                  There&apos;s no Nexora account for <span className="font-medium">{preview.email}</span> yet. Create an account with
                  that email address, then open this invitation link again.
                </p>
                <div className="flex gap-2">
                  <Button className="flex-1" asChild>
                    <Link href="/register">Create account</Link>
                  </Button>
                  <Button variant="outline" className="flex-1" asChild>
                    <Link href="/login">Sign in</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {needsSignIn ? (
                  <p className="rounded-md border border-amber-300/60 bg-amber-50 p-2 text-[13px] dark:bg-amber-500/10">
                    {errorMessage}. <Link href={`/login?next=/invitations/${token}`} className="font-medium underline underline-offset-2">Sign in</Link>{" "}
                    to continue.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Accepting adds you to this workspace with the role above. You can leave anytime from workspace settings.
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    disabled={screen === "accepting" || screen === "declining"}
                    onClick={() => void run("accept")}
                  >
                    {screen === "accepting" ? "Accepting…" : (<><Check className="size-4" /> Accept invitation</>)}
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    disabled={screen === "accepting" || screen === "declining"}
                    onClick={() => void run("decline")}
                  >
                    {screen === "declining" ? "Declining…" : (<><X className="size-4" /> Decline</>)}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : screen === "accepted" || screen === "declined" ? (
          <div className="mt-6 text-center" role="status">
            <span
              className={
                screen === "accepted"
                  ? "mx-auto flex size-12 items-center justify-center rounded-full bg-success/15"
                  : "mx-auto flex size-12 items-center justify-center rounded-full bg-muted"
              }
            >
              {screen === "accepted" ? <Check className="size-6 text-success" /> : <X className="size-6 text-muted-foreground" />}
            </span>
            <h1 className="mt-3 text-lg font-semibold">
              {screen === "accepted" ? "Welcome aboard!" : "Invitation declined"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {screen === "accepted"
                ? result ?? "Your membership is active."
                : "The sender will see the invitation as declined."}
            </p>
            <Button className="mt-5 w-full" onClick={() => router.push("/dashboard")}>
              Go to my dashboard
            </Button>
          </div>
        ) : null}

        {screen === "error" && preview ? (
          <div className="mt-6 space-y-4 text-center" role="alert">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="size-6 text-destructive" />
            </span>
            <div>
              <h1 className="text-lg font-semibold">Couldn&apos;t complete that</h1>
              <p className="mt-1 text-sm text-muted-foreground">{errorMessage}</p>
            </div>
            <Button variant="outline" className="w-full" onClick={() => setScreen("ready")}>
              Back
            </Button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
