"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Fingerprint,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import type { AdminOverview } from "@/lib/admin-api";
import { ErrorState, EmptyState } from "@/components/ui/state";

const ICONS = {
  users: Users,
  sessions: Fingerprint,
  orgs: ShieldCheck,
  signups: UserCheck,
  activity: Activity,
} as const;

function MetricCard({
  icon,
  label,
  value,
  secondary,
  loading,
}: {
  icon: keyof typeof ICONS;
  label: string;
  value: string;
  secondary?: string;
  loading?: boolean;
}) {
  const Icon = ICONS[icon];
  return (
    <article className="rounded-xl border bg-card p-5 shadow-xs" aria-busy={loading || undefined}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">{label}</h2>
        <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground" aria-hidden>
          <Icon className="size-4" />
        </span>
      </div>
      {loading ? (
        <div className="mt-3 space-y-2" aria-hidden>
          <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />
          <div className="h-3.5 w-32 animate-pulse rounded bg-muted" />
        </div>
      ) : (
        <>
          <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums">{value}</p>
          {secondary ? <p className="mt-1.5 text-[13px] text-muted-foreground">{secondary}</p> : null}
        </>
      )}
    </article>
  );
}

export default function AdminOverviewPage() {
  const overview = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => apiFetch<AdminOverview>("/api/admin/overview"),
    staleTime: 60_000,
  });

  const data = overview.data;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold tracking-wide text-primary">
            <ShieldCheck className="size-4" aria-hidden /> Control plane
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Platform overview</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Live aggregates across the whole Nexora deployment — computed from platform data on every load.
          </p>
        </div>
      </div>

      {overview.isLoading ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5" aria-label="Loading overview">
          {(["users", "sessions", "orgs", "signups", "activity"] as const).map((k) => (
            <MetricCard key={k} icon={k} label={LABELS[k]} value="—" loading />
          ))}
        </div>
      ) : overview.isError ? (
        <div className="mt-8">
          <ErrorState
            title="Couldn't load platform overview"
            message="The overview API didn't respond. Refresh to try again."
            onRetry={() => void overview.refetch()}
          />
        </div>
      ) : !data ? (
        <div className="mt-8">
          <EmptyState title="No overview data" description="The platform service returned no aggregate data." />
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <MetricCard
            icon="users"
            label="Total users"
            value={data.users.total.toLocaleString()}
            secondary={`${data.users.verified.toLocaleString()} with verified email`}
          />
          <MetricCard
            icon="sessions"
            label="Active sessions"
            value={data.users.activeSessionsToday.toLocaleString()}
            secondary="Sessions active in the last 24h"
          />
          <MetricCard
            icon="orgs"
            label="Organizations"
            value={data.organizations.total.toLocaleString()}
            secondary={`${data.organizations.totalMembers.toLocaleString()} memberships across workspaces`}
          />
          <MetricCard
            icon="signups"
            label="New signups"
            value={data.signupsLast7d.toLocaleString()}
            secondary="Accounts created in the last 7 days"
          />
          <MetricCard
            icon="activity"
            label="Platform activity"
            value={data.activityLast24h.toLocaleString()}
            secondary="Logged events in the last 24h"
          />
        </div>
      )}

      <section className="mt-10 rounded-xl border bg-muted/30 p-5 sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">What&apos;s included</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          This dashboard is intentionally limited to what the platform service reports: account, session, organization
          and activity totals. Plan distribution, per-organization usage and other aggregates are not exposed by the
          platform API, so they are not shown here.
        </p>
      </section>
    </div>
  );
}

const LABELS: Record<keyof typeof ICONS, string> = {
  users: "Total users",
  sessions: "Active sessions",
  orgs: "Organizations",
  signups: "New signups",
  activity: "Platform activity",
};
