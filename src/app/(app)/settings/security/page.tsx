"use client";

import * as React from "react";
import { Copy, KeyRound, Loader2, MailCheck, MonitorSmartphone, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { useMe } from "@/lib/hooks/use-session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import type { SessionDTO } from "@/types";

interface Provision {
  secret: string;
  otpauthUrl: string;
  account: string;
}

function parseError(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

export default function SecuritySettingsPage() {
  const me = useMe();
  const qc = useQueryClient();
  const user = me.data?.user;

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Security</h1>
          <p className="text-[13px] text-muted-foreground">Password, two-factor authentication and sessions.</p>
        </div>
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  const refreshMe = () => qc.invalidateQueries({ queryKey: qk.me });

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Security</h1>
        <p className="text-[13px] text-muted-foreground">Password, two-factor authentication and sessions.</p>
      </div>

      {!user.emailVerified ? <VerifyEmailCard /> : null}
      <PasswordCard user={user} onChanged={refreshMe} />
      <TwoFactorCard user={user} onChanged={refreshMe} />
      <SessionsCard />
    </div>
  );
}

/* ------------------------- Email verification ------------------------ */

function VerifyEmailCard() {
  const resend = useMutation({
    mutationFn: () => apiFetch("/api/auth/resend-verification", { method: "POST" }),
    onSuccess: () => toast.success("Verification email sent — check your inbox."),
    onError: (e) => toast.error(parseError(e, "Couldn't resend the email.")),
  });
  return (
    <Card className="border-amber-300/60 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <MailCheck className="size-4 text-amber-600" /> Verify your email
        </CardTitle>
        <CardDescription>
          Some workspace actions require a verified address. Check your inbox and follow the link, or resend the email.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button size="sm" variant="outline" onClick={() => resend.mutate()} disabled={resend.isPending}>
          {resend.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Resend verification email
        </Button>
      </CardContent>
    </Card>
  );
}

/* ---------------------------- Password ------------------------------- */

function PasswordCard({ user, onChanged }: { user: { hasPassword: boolean }; onChanged: () => void }) {
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [show, setShow] = React.useState(false);

  const change = useMutation({
    mutationFn: () =>
      apiFetch("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      }),
    onSuccess: () => {
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success("Password updated — other sessions were signed out.");
      onChanged();
    },
    onError: (e) => toast.error(parseError(e, "Couldn't change the password.")),
  });

  const valid =
    current.length > 0 &&
    next.length >= 8 &&
    next === confirm;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <KeyRound className="size-4 text-muted-foreground" /> Password
        </CardTitle>
        <CardDescription>
          {user.hasPassword
            ? "Changing your password signs out your other sessions."
            : "You signed up with a social provider; password sign-in isn't available."}
        </CardDescription>
      </CardHeader>
      {user.hasPassword ? (
        <CardContent className="space-y-3.5">
          <div className="grid gap-3.5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pwd-current">Current password</Label>
              <Input id="pwd-current" type={show ? "text" : "password"} value={current} autoComplete="current-password" onChange={(e) => setCurrent(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pwd-new">New password</Label>
              <Input id="pwd-new" type={show ? "text" : "password"} value={next} autoComplete="new-password" onChange={(e) => setNext(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="pwd-confirm">Confirm new password</Label>
              <Input id="pwd-confirm" type={show ? "text" : "password"} value={confirm} autoComplete="new-password" onChange={(e) => setConfirm(e.target.value)} />
              {next && next.length < 8 ? <p className="text-xs text-destructive">At least 8 characters.</p> : null}
              {confirm && next !== confirm ? <p className="text-xs text-destructive">Passwords don&apos;t match.</p> : null}
            </div>
            <Button className="sm:mb-0.5" disabled={!valid || change.isPending} onClick={() => change.mutate()}>
              {change.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Update password
            </Button>
            <Button variant="ghost" className="sm:mb-0.5" onClick={() => setShow((s) => !s)}>
              {show ? "Hide" : "Show"}
            </Button>
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
}

/* --------------------------- Two factor ------------------------------ */

function TwoFactorCard({ user, onChanged }: { user: { twoFactorEnabled: boolean }; onChanged: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [provision, setProvision] = React.useState<Provision | null>(null);
  const [provisioning, setProvisioning] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [disableOpen, setDisableOpen] = React.useState(false);
  const [disableCode, setDisableCode] = React.useState("");

  const startProvision = async () => {
    setProvisioning(true);
    try {
      const data = await apiFetch<Provision>("/api/auth/two-factor");
      setProvision(data);
      setCode("");
      setOpen(true);
    } catch (e) {
      toast.error(parseError(e, "Couldn't start setup."));
    } finally {
      setProvisioning(false);
    }
  };

  const enable = async () => {
    if (!provision || code.trim().length < 6) {
      toast.error("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setBusy(true);
    try {
      await apiFetch("/api/auth/two-factor/enable", {
        method: "POST",
        body: JSON.stringify({ secret: provision.secret, code: code.trim() }),
      });
      setOpen(false);
      setProvision(null);
      toast.success("Two-factor authentication enabled — existing sessions were signed out, so sign in again with your code next time.");
      onChanged();
    } catch (e) {
      toast.error(parseError(e, "That code didn't work — check your authenticator app."));
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      await apiFetch("/api/auth/two-factor/disable", {
        method: "POST",
        body: JSON.stringify({ code: disableCode.trim() }),
      });
      setDisableOpen(false);
      setDisableCode("");
      toast.success("Two-factor authentication disabled");
      onChanged();
    } catch (e) {
      toast.error(parseError(e, "That code didn't work."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <ShieldCheck className="size-4 text-muted-foreground" /> Two-factor authentication
        </CardTitle>
        <CardDescription>
          {user.twoFactorEnabled
            ? "An authenticator code is required when you sign in."
            : "Add a one-time password from an authenticator app to protect your account."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {user.twoFactorEnabled ? (
          <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setDisableOpen(true)}>
            <ShieldCheck className="size-4" /> Disable two-factor
          </Button>
        ) : (
          <Button size="sm" onClick={startProvision} disabled={provisioning}>
            {provisioning ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} Set up authenticator app
          </Button>
        )}

        {open && provision ? (
          <div className="mt-4 space-y-3 rounded-lg border bg-muted/30 p-4">
            <p className="text-[13px]">
              Add <span className="font-medium">{provision.account}</span> to your authenticator app (Google Authenticator,
              Authy, 1Password, …) using the secret below, then confirm with the 6-digit code.
            </p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 rounded-md border bg-card px-2.5 py-1.5 font-mono text-xs break-all" aria-label="Setup key">
                {provision.secret}
              </code>
              <Button
                variant="outline"
                size="sm"
                aria-label="Copy setup key"
                onClick={() => {
                  void navigator.clipboard.writeText(provision.secret);
                  toast.success("Setup key copied");
                }}
              >
                <Copy className="size-3.5" />
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="6-digit code"
                inputMode="numeric"
                className="w-40"
                aria-label="Authenticator code"
                onKeyDown={(e) => e.key === "Enter" && void enable()}
              />
              <Button size="sm" disabled={busy} onClick={enable}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : null} Verify and enable
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        {disableOpen ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-4">
            <p className="w-full text-[13px]">
              Enter the current code from your authenticator app to disable. If your current session isn&apos;t verified yet,
              sign out and sign back in with a code first.
            </p>
            <Input
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="6-digit code"
              inputMode="numeric"
              className="w-40"
              aria-label="Authenticator code to disable"
              onKeyDown={(e) => e.key === "Enter" && void disable()}
            />
            <Button size="sm" variant="destructive" disabled={busy} onClick={disable}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null} Disable
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDisableOpen(false)}>
              Cancel
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/* ----------------------------- Sessions ------------------------------ */

function SessionsCard() {
  const sessions = useQuery({
    queryKey: ["auth-sessions"],
    queryFn: () => apiFetch<{ sessions: SessionDTO[] }>("/api/auth/sessions"),
    refetchInterval: 60_000,
  });

  const invalidate = () => sessions.refetch();

  const revokeAll = useMutation({
    mutationFn: () => apiFetch("/api/auth/sessions", { method: "POST" }),
    onSuccess: () => {
      invalidate();
      toast.success("Other sessions signed out");
    },
    onError: (e) => toast.error(parseError(e, "Couldn't sign out other sessions.")),
  });

  const revokeOne = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/auth/sessions/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidate(),
    onError: (e) => toast.error(parseError(e, "Couldn't revoke that session.")),
  });

  const list = sessions.data?.sessions ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <MonitorSmartphone className="size-4 text-muted-foreground" /> Active sessions
        </CardTitle>
        <CardDescription>Devices currently signed in to your account.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {sessions.isLoading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : sessions.isError ? (
          <p className="text-[13px] text-destructive">
            {sessions.error instanceof Error ? sessions.error.message : "Couldn't load sessions."}
          </p>
        ) : list.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No active sessions.</p>
        ) : (
          <ul role="list" className="space-y-1.5">
            {list.map((s) => (
              <li key={s.id} className="flex items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2.5">
                <span aria-hidden className="flex size-8 items-center justify-center rounded-full bg-secondary">
                  <MonitorSmartphone className="size-4 text-muted-foreground" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-[13px] font-medium">
                    <span className="truncate">{s.userAgent || "Unknown device"}</span>
                    {s.current ? <Badge variant="muted" className="normal-case">This device</Badge> : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.ip ? `${s.ip} · ` : ""}Last active {formatDateTime(s.lastActiveAt)} · Expires {formatDateTime(s.expiresAt)}
                  </p>
                </div>
                {!s.current ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Revoke session"
                    className="text-muted-foreground hover:text-destructive"
                    disabled={revokeOne.isPending}
                    onClick={() => revokeOne.mutate(s.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {list.length > 1 ? (
          <Button variant="outline" size="sm" disabled={revokeAll.isPending} onClick={() => revokeAll.mutate()}>
            {revokeAll.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Sign out other devices
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
