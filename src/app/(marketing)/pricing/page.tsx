import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { PLANS, PLAN_LIMITS, PLAN_PRICING, type PlanKey } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Pricing — simple plans for growing teams",
  description:
    "Free, Pro and Business plans for Nexora. Seat, project, storage and feature limits are enforced in-app; plans are managed by the workspace owner.",
  alternates: { canonical: "/pricing" },
};

const REGISTER = "/register?next=%2Fdashboard";

function storage(mb: number | null): string {
  if (mb === null) return "100 GB";
  if (mb >= 1000) return `${mb / 1000} GB`;
  return `${mb} MB`;
}

interface Row {
  label: string;
  value: (p: PlanKey) => string | boolean;
  sub?: string;
}

const ROWS: Row[] = [
  {
    label: "Members",
    value: (p) => (PLAN_LIMITS[p].members === null ? "Unlimited members" : `Up to ${PLAN_LIMITS[p].members} members`),
  },
  {
    label: "Projects",
    value: (p) => (PLAN_LIMITS[p].projects === null ? "Unlimited projects" : `Up to ${PLAN_LIMITS[p].projects} projects`),
  },
  { label: "File storage", value: (p) => storage(PLAN_LIMITS[p].storageMb) },
  { label: "Sprints & milestones", value: () => true },
  {
    label: "Time tracking",
    value: (p) => PLAN_LIMITS[p].timeTracking,
    sub: "Timer and manual entries",
  },
  {
    label: "Advanced analytics",
    value: (p) => PLAN_LIMITS[p].advancedAnalytics,
    sub: "Trends, distributions & workload",
  },
  {
    label: "Webhook endpoints",
    value: (p) => (PLAN_LIMITS[p].webhooks > 0 ? `${PLAN_LIMITS[p].webhooks} endpoints` : false),
    sub: "HMAC-SHA256 signed deliveries",
  },
  {
    label: "AI assistant",
    value: (p) =>
      PLAN_LIMITS[p].aiRequestsPerMemberPerDay === 0
        ? false
        : `${PLAN_LIMITS[p].aiRequestsPerMemberPerDay}/member/day`,
    sub: "Pluggable provider, per-member caps",
  },
];

const EVERY_PLAN = [
  "Multi-tenant workspaces with org-scoped data",
  "Role-based access: owner, admin, member, guest",
  "Projects, kanban boards, subtasks and priorities",
  "Team calendar and org-wide search",
  "Chat: DMs, groups and project channels",
  "Comments with mentions and reactions",
  "Notification center",
  "Secure sessions with optional TOTP two-factor",
  "REST API and activity log",
];

export default function PricingPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8 sm:py-20">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold tracking-wide text-primary">Pricing</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          Plans that grow with your organization
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Three tiers, one codebase. Limits below come straight from the app&apos;s plan catalog and are enforced
          server-side — no checkout here, plans are managed by the workspace owner.
        </p>
      </div>

      <div className="mt-12 grid gap-5 lg:grid-cols-3">
        {PLANS.map((plan) => {
          const pricing = PLAN_PRICING[plan];
          const featured = plan === "pro";
          return (
            <section
              key={plan}
              aria-label={`${plan} plan`}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-card p-6 shadow-xs",
                featured && "border-primary/50 shadow-lg shadow-primary/5 ring-1 ring-primary/20"
              )}
            >
              {featured ? (
                <p className="absolute -top-3 left-6 rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
                  Most popular
                </p>
              ) : null}
              <h2 className="text-lg font-bold capitalize tracking-tight">{plan}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{pricing.tagline}</p>

              <div className="mt-5 flex items-baseline gap-1.5">
                <span className="text-4xl font-bold tracking-tight tabular-nums">
                  {pricing.monthly === 0 ? "$0" : `$${pricing.monthly}`}
                </span>
                <span className="text-sm text-muted-foreground">/ month</span>
              </div>

              <Link
                href={REGISTER}
                className={cn(
                  buttonVariants({ variant: featured ? "default" : "outline" }),
                  "mt-5 w-full"
                )}
              >
                {plan === "free" ? "Start free" : `Choose ${plan}`}
                <ArrowRight className="size-4" aria-hidden />
              </Link>

              <div className="mt-6 border-t pt-5">
                <ul className="space-y-3">
                  {ROWS.map((row) => {
                    const v = row.value(plan);
                    return (
                      <li key={row.label} className="flex items-start gap-2.5">
                        {v === false ? (
                          <Minus className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" aria-hidden />
                        ) : (
                          <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-success/15">
                            <Check className="size-3 text-success" aria-hidden />
                          </span>
                        )}
                        <span className="min-w-0">
                          <span className={cn("block text-sm", v === false && "text-muted-foreground/60")}>
                            {row.label}
                            {v !== false && typeof v === "string" ? (
                              <span className="text-muted-foreground"> — {v}</span>
                            ) : null}
                          </span>
                          {row.sub && v !== false ? (
                            <span className="block text-xs text-muted-foreground/80">{row.sub}</span>
                          ) : null}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>
          );
        })}
      </div>

      <div className="mx-auto mt-14 max-w-3xl">
        <section className="rounded-xl border bg-muted/30 p-5 sm:p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Included in every plan</h2>
          <ul className="mt-4 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
            {EVERY_PLAN.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm">
                <span className="mt-1 flex size-4 shrink-0 items-center justify-center rounded-full bg-success/15">
                  <Check className="size-3 text-success" aria-hidden />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </section>

        <aside className="mt-6 rounded-xl border border-dashed p-5 text-sm leading-relaxed text-muted-foreground sm:p-6">
          <h2 className="font-semibold text-foreground">How plans work in this build</h2>
          <p className="mt-2">
            Plan data on this page is the same catalog the application enforces: the Free plan is the default, and plan
            limits (seats, projects, storage, features) gate the product server-side. Plan changes are performed by the
            workspace owner from <span className="font-medium text-foreground">Settings → Billing</span>. This build does
            not collect payments — there is no checkout, no card handling and no payment provider. Pricing above is
            informational product-plan data.
          </p>
          <p className="mt-3">
            <Link href={REGISTER} className="font-medium text-primary underline-offset-4 hover:underline">
              Create an account to try every Free-tier feature
            </Link>{" "}
            ·{" "}
            <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
              or log in
            </Link>
            .
          </p>
        </aside>
      </div>
    </div>
  );
}
