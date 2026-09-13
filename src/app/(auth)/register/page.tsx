"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { safeNext } from "@/lib/safe-next";
import { AuthAlert, AuthCard, AuthSubmitButton, FieldError, PasswordField, goAfterAuth, RateLimitHint } from "@/components/auth/auth-ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/field";
import { Check, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function RegisterPage() {
  return (
    <React.Suspense fallback={<Skeleton className="h-64 w-full max-w-md rounded-2xl" />}>
      <RegisterInner />
    </React.Suspense>
  );
}

const RULES = [
  { re: /.{8,}/, label: "At least 8 characters" },
  { re: /[a-zA-Z]/, label: "At least one letter" },
  { re: /[0-9]/, label: "At least one number" },
] as const;

function RegisterInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next");

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [rateLimited, setRateLimited] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const meQ = useQuery({
    queryKey: ["auth-session-check"],
    queryFn: () => apiFetch<{ user: { id: string } }>("/api/auth/me", { skipAuthRedirect: true }),
    retry: false,
    staleTime: 0,
  });
  React.useEffect(() => {
    if (meQ.data && !meQ.isFetching) router.replace(safeNext(next) || "/dashboard");
  }, [meQ.data, meQ.isFetching, router, next]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setRateLimited(false);
    const errs: Record<string, string> = {};
    const nameTrim = name.trim();
    const emailTrim = email.trim().toLowerCase();
    if (nameTrim.length < 2) errs.name = "Name must be at least 2 characters.";
    else if (nameTrim.length > 80) errs.name = "Name must be under 80 characters.";
    else if (nameTrim.includes("\n")) errs.name = "Name cannot contain line breaks.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) errs.email = "Enter a valid email address.";
    if (password.length < 8) errs.password = "Password must be at least 8 characters.";
    else if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) errs.password = "Include at least one letter and one number.";
    else if (password.length > 72) errs.password = "Password must be under 72 characters.";
    if (confirm !== password) errs.confirm = "Passwords don't match.";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setBusy(true);
    try {
      await apiFetch("/api/auth/register", {
        method: "POST",
        body: { name: nameTrim, email: emailTrim, password },
        skipAuthRedirect: true,
      });
      await goAfterAuth(next, router);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't create your account.";
      setServerError(msg);
      setRateLimited(/too many|try again/i.test(msg));
      setBusy(false);
    }
  };

  const ok = (re: RegExp) => re.test(password);

  return (
    <AuthCard
      title="Create your account"
      subtitle={
        <>
          Already have an account?{" "}
          <Link href={safeNext(next) ? `/login?next=${encodeURIComponent(safeNext(next))}` : "/login"} className="font-medium text-primary underline-offset-2 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="reg-name">Full name</Label>
          <Input id="reg-name" value={name} autoComplete="name" autoFocus maxLength={80} onChange={(e) => setName(e.target.value)} />
          <FieldError id="reg-name-error" message={errors.name} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reg-email">Email</Label>
          <Input id="reg-email" type="email" value={email} autoComplete="email" maxLength={254} onChange={(e) => setEmail(e.target.value)} />
          <FieldError id="reg-email-error" message={errors.email} />
        </div>
        <div className="space-y-1.5">
          <PasswordField
            id="reg-password"
            label="Password"
            value={password}
            autoComplete="new-password"
            onChange={(v) => setPassword(v)}
            hint={
              <ul className="space-y-0.5">
                {RULES.map((r) => (
                  <li key={r.label} className={ok(r.re) ? "text-success" : ""}>
                    {ok(r.re) ? (
                      <Check className="mr-1 inline size-3" aria-hidden />
                    ) : (
                      <X className="mr-1 inline size-3 opacity-50" aria-hidden />
                    )}
                    {r.label}
                  </li>
                ))}
              </ul>
            }
          />
          <FieldError id="reg-password-error" message={errors.password} />
        </div>
        <div className="space-y-1.5">
          <PasswordField id="reg-confirm" label="Confirm password" value={confirm} autoComplete="new-password" onChange={(v) => setConfirm(v)} />
          <FieldError id="reg-confirm-error" message={errors.confirm} />
        </div>

        {serverError ? (
          <div className="space-y-2">
            <AuthAlert message={serverError} />
            {rateLimited ? <RateLimitHint /> : null}
          </div>
        ) : null}

        <AuthSubmitButton loading={busy}>Create account</AuthSubmitButton>
        <p className="text-center text-xs text-muted-foreground">
          Registration may be temporarily limited per device. Passwords are stored as salted hashes and never shared.
        </p>
      </form>
    </AuthCard>
  );
}
