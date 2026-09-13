import type { Metadata } from "next";
import Link from "next/link";
import {
  Cookie,
  EyeOff,
  Fingerprint,
  KeyRound,
  Lock,
  Mail,
  Radio,
  ShieldCheck,
  Timer,
  UserX,
  Webhook,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Security — how Nexora protects your workspace",
  description:
    "The concrete security architecture behind Nexora: session cookies, password hashing, TOTP 2FA, role-based authorization, tenant isolation, webhook signatures, rate limiting and more.",
  alternates: { canonical: "/security" },
};

interface Control {
  icon: typeof Lock;
  title: string;
  text: string;
}

const GROUPS: { id: string; title: string; blurb: string; controls: Control[] }[] = [
  {
    id: "authentication",
    title: "Authentication",
    blurb: "Credentials, sessions and second factors — with details that are easy to get wrong handled deliberately.",
    controls: [
      {
        icon: Lock,
        title: "Password storage",
        text: "Passwords are hashed with bcrypt at cost 12 before storage — never stored in plain text or reversible form.",
      },
      {
        icon: Cookie,
        title: "Session cookies",
        text: "Sessions ride in an httpOnly cookie (nexora.session), SameSite=Lax, Secure in production — JavaScript never reads the token.",
      },
      {
        icon: Timer,
        title: "Session lifetime",
        text: "Default sessions expire after 7 days; “keep me signed in” extends to 30. Users can list and revoke any session from their security settings.",
      },
      {
        icon: Mail,
        title: "Email verification",
        text: "Verification links are single-use and expire after 24 hours; a signed-in user can request a resend (rate-limited).",
      },
      {
        icon: Fingerprint,
        title: "Two-factor (TOTP)",
        text: "RFC-6238 one-time codes with 30-second steps, compatible with common authenticator apps. The shared secret is stored encrypted.",
      },
      {
        icon: EyeOff,
        title: "Anti-enumeration",
        text: "Sign-in failures return the same message whether the email exists or not, and password-reset requests always answer “sent” — accounts can't be probed through the API.",
      },
    ],
  },
  {
    id: "authorization",
    title: "Authorization & isolation",
    blurb: "Access is decided by a permission registry shared with the UI, then enforced again server-side on every request.",
    controls: [
      {
        icon: KeyRound,
        title: "Role-based access",
        text: "Organization roles (owner, admin, member, guest) and per-project roles (manager, member, viewer) each map to an explicit permission list. Billing is owner-only; guests are read-mostly.",
      },
      {
        icon: ShieldCheck,
        title: "Tenant isolation",
        text: "Every data model is org-scoped and every service query filters by organization. Cross-tenant requests fail server-side with not-found/forbidden — never leak data.",
      },
      {
        icon: UserX,
        title: "Member control",
        text: "Members can be suspended, removed or re-rolled by workspace admins; invitations expire after 7 days and can be revoked.",
      },
      {
        icon: Lock,
        title: "Input validation",
        text: "All API bodies are parsed with Zod schemas shared with the client — lengths, formats and enums are bounded before they touch the database.",
      },
    ],
  },
  {
    id: "platform",
    title: "Platform protections",
    blurb: "The network-facing edges — rate limits, redirects, webhooks and realtime — are hardened at the framework layer.",
    controls: [
      {
        icon: Timer,
        title: "Rate limiting",
        text: "Per-IP and per-user buckets guard registration (5/hour), sign-in (20/15m per IP, 10/15m per user), password reset, and 2FA verification (8/15m).",
      },
      {
        icon: Webhook,
        title: "Webhook signatures",
        text: "Every delivery carries X-Nexora-Signature: a timestamped HMAC-SHA256 over the raw body. Endpoint secrets are shown once at creation and can be rotated or paused.",
      },
      {
        icon: Radio,
        title: "Safe redirects",
        text: "Post-auth navigation only accepts same-site paths: protocol-relative, encoded-backslash and external destinations are rejected before any redirect happens.",
      },
      {
        icon: Lock,
        title: "Security headers",
        text: "Every response sets X-Content-Type-Options: nosniff, X-Frame-Options: DENY, strict Referrer-Policy, HSTS and a restrictive Permissions-Policy via the Next.js config.",
      },
    ],
  },
];

export default function SecurityPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold tracking-wide text-primary">Security</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          Security architecture, spelled out
        </h1>
        <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
          This page describes the controls actually implemented in the Nexora codebase — how sessions, passwords,
          authorization, isolation and webhooks work under the hood. No compliance badges, no invented certifications:
          concrete engineering, stated plainly.
        </p>
      </div>

      <div className="mt-14 space-y-16">
        {GROUPS.map((group) => (
          <section key={group.id} id={group.id} aria-labelledby={`${group.id}-heading`} className="scroll-mt-24">
            <div className="max-w-2xl">
              <h2 id={`${group.id}-heading`} className="text-xl font-bold tracking-tight sm:text-2xl">
                {group.title}
              </h2>
              <p className="mt-1.5 text-[15px] text-muted-foreground">{group.blurb}</p>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {group.controls.map((c) => (
                <article key={c.title} className="flex gap-4 rounded-xl border bg-card p-5 shadow-xs">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground" aria-hidden>
                    <c.icon className="size-5" />
                  </span>
                  <div>
                    <h3 className="font-semibold tracking-tight">{c.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{c.text}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}

        <aside className="rounded-2xl border border-dashed p-6 text-sm leading-relaxed text-muted-foreground sm:p-8">
          <h2 className="font-semibold text-foreground">Scope &amp; honest limits</h2>
          <p className="mt-2">
            The controls above are real implementation details of this codebase, written as security engineering
            practice — they are not a promise of production readiness, and this project holds no compliance
            certifications or security audits. Sensitive values (secrets, session tokens, encryption keys) are never
            disclosed here or anywhere in this documentation. If you adopt the architecture, review it with your own
            threat model first.
          </p>
        </aside>
      </div>

      <div className="mt-12 flex flex-col items-center gap-3 text-center">
        <Link href="/register?next=%2Fdashboard" className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}>
          Create a workspace and try it
        </Link>
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
