import type { Metadata } from "next";
import Link from "next/link";
import {
  Building2,
  FileCode2,
  KeyRound,
  LayoutGrid,
  Radio,
  Server,
  ShieldCheck,
  Webhook,
  Workflow,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "About — an engineering-first SaaS workspace",
  description:
    "Nexora is a production-oriented project workspace built to explore real SaaS architecture: multi-tenancy, authorization, realtime events, rate limiting, webhooks and more.",
  alternates: { canonical: "/about" },
};

const PILLARS = [
  {
    icon: Building2,
    title: "Multi-tenant by design",
    text: "Every document — projects, tasks, sprints, conversations, files, time entries, webhooks — carries an organizationId and every service query filters on it. Tenant isolation is a data-model property, not a UI convention.",
  },
  {
    icon: KeyRound,
    title: "Authorization, twice",
    text: "A permission registry shared by client and server describes what each org role (owner → guest) and project role (manager → viewer) may do. The server enforces it on every request; the UI only hides what the API would refuse.",
  },
  {
    icon: ShieldCheck,
    title: "Security as practice",
    text: "Bcrypt-hashed passwords, httpOnly session cookies with inventory and revocation, TOTP two-factor with encrypted secrets, signed short-lived challenges, rate-limited auth flows, anti-enumeration responses and same-site redirect policy.",
  },
  {
    icon: Radio,
    title: "Realtime without lock-in",
    text: "Domain events publish to an org-scoped bus with a pluggable transport — no-op locally, Pusher-compatible when configured. Mutations stay REST-first and replay-safe; realtime is only fan-out.",
  },
  {
    icon: Webhook,
    title: "Extensible by contract",
    text: "A typed REST API (Zod-validated, consistent JSON envelopes) is the substrate; HMAC-signed webhooks with retries and delivery history let external systems subscribe to workspace events.",
  },
  {
    icon: Server,
    title: "Rate limited everywhere it counts",
    text: "Login, registration, password reset and 2FA carry per-IP and per-user buckets with user-safe copy — the same limits the UI surfaces inline.",
  },
  {
    icon: Zap,
    title: "Optional AI, not vendor-locked",
    text: "An assistant feature sits behind a provider abstraction with per-member daily caps from the plan catalog. The core product never requires an AI provider to run.",
  },
  {
    icon: Workflow,
    title: "Billing architecture without payments",
    text: "A plan catalog (Free/Pro/Business) gates members, projects, storage, analytics, time tracking, webhooks and AI server-side. Plan changes are owner-only and payment collection is intentionally out of scope.",
  },
] as const;

const STACK = [
  { icon: FileCode2, name: "Next.js App Router", detail: "Route groups: (app), (auth), (marketing) · static marketing pages · serverless API routes" },
  { icon: FileCode2, name: "TypeScript", detail: "Shared domain types and Zod schemas between client and server" },
  { icon: LayoutGrid, name: "Tailwind CSS v4 design tokens", detail: "One dark/light token set powers the app and this site" },
  { icon: Server, name: "MongoDB + Mongoose", detail: "Org-scoped models with full-text indexes and activity logging" },
  { icon: ShieldCheck, name: "Security primitives", detail: "bcrypt, RFC-6238 TOTP, HMAC-SHA256 signing — implemented in-repo" },
  { icon: KeyRound, name: "Session management", detail: "httpOnly cookies, inventory, revocation, remember-me lifetime" },
] as const;

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold tracking-wide text-primary">About</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          A production-oriented SaaS workspace, built to explore the hard parts
        </h1>
        <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
          Nexora is a working, multi-tenant project-management platform — projects, boards, sprints, chat, analytics and
          webhooks in one product. It is also an engineering artifact: a deliberate exercise in the architecture that
          modern collaborative SaaS demands, written in the open as a portfolio project rather than a company with
          customers.
        </p>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
          The interesting parts are the ones users never see: tenancy isolation that holds up under hand-crafted
          requests, an authorization model enforced twice, rate limits with humane copy, sessions you can revoke, and a
          realtime layer that doesn&apos;t compromise REST semantics.
        </p>
      </div>

      {/* Pillars */}
      <section aria-labelledby="pillars-heading" className="mt-16">
        <h2 id="pillars-heading" className="text-xl font-bold tracking-tight sm:text-2xl">
          Engineering pillars
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {PILLARS.map((p) => (
            <article key={p.title} className="flex gap-4 rounded-xl border bg-card p-5 shadow-xs">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground" aria-hidden>
                <p.icon className="size-5" />
              </span>
              <div>
                <h3 className="font-semibold tracking-tight">{p.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{p.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Stack */}
      <section aria-labelledby="stack-heading" className="mt-16">
        <h2 id="stack-heading" className="text-xl font-bold tracking-tight sm:text-2xl">
          The stack
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STACK.map((s) => (
            <article key={s.name} className="rounded-xl border bg-card p-5 shadow-xs">
              <h3 className="flex items-center gap-2 font-semibold tracking-tight">
                <s.icon className="size-4 text-primary" aria-hidden /> {s.name}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.detail}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Honesty */}
      <section aria-labelledby="scope-heading" className="mt-16 rounded-2xl border bg-muted/30 p-6 sm:p-8">
        <h2 id="scope-heading" className="text-lg font-bold tracking-tight">
          What this project is — and isn&apos;t
        </h2>
        <div className="mt-4 grid gap-6 text-sm leading-relaxed text-muted-foreground sm:grid-cols-2">
          <ul className="space-y-2.5">
            <li><span className="font-medium text-foreground">It is:</span> a fully functional workspace you can register for, create an organization in, and use end to end — with live API verification across every module.</li>
            <li><span className="font-medium text-foreground">It is:</span> deployable on Vercel: static marketing pages, serverless API routes, and environment-driven configuration.</li>
            <li><span className="font-medium text-foreground">It is:</span> honest about scope — every page, including this one, lists only capabilities that exist in the code.</li>
          </ul>
          <ul className="space-y-2.5">
            <li><span className="font-medium text-foreground">It is not:</span> a company with real customers, revenue or uptime commitments — you won&apos;t find fabricated logos or testimonials here.</li>
            <li><span className="font-medium text-foreground">It is not:</span> a payment processor. Plan tiers gate the product; collecting money is deliberately out of scope.</li>
            <li><span className="font-medium text-foreground">It is not:</span> a claim of production hardening. It is an ambitious, working architecture worth reviewing — and improving.</li>
          </ul>
        </div>
      </section>

      <div className="mt-12 flex flex-col items-center gap-3 text-center">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">See it running</h2>
        <p className="max-w-xl text-[15px] text-muted-foreground">
          The fastest way to evaluate the architecture is to click through the product itself.
        </p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <Link href="/register?next=%2Fdashboard" className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}>
            Create a workspace
          </Link>
          <Link href="/features" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full sm:w-auto")}>
            Browse the feature catalog
          </Link>
        </div>
      </div>
    </div>
  );
}
