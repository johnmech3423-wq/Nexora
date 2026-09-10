"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  CircleDot,
  FolderKanban,
  ListTodo,
  Sparkles,
  Users,
} from "lucide-react";
import { apiFetch, qs } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { useRouter } from "next/navigation";
import { useActiveOrgId, useOrganizations, useMe } from "@/lib/hooks/use-session";
import { apiErrorMessage, isPlanRequired } from "@/components/features/error-handling";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/ui/state";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/controls";
import { formatDate, cn } from "@/lib/utils";
import { ActivityItem } from "@/components/features/activity-utils";
import { PlanGateCard } from "@/components/features/plan-gate";
import { TrendAreaChart, DonutChart, BarDistributionChart, PIE_COLORS } from "@/components/features/charts";
import type { AnalyticsSummaryDTO, ProjectSummaryDTO, ActivityDTO, TrendPoint, PriorityDist, StatusDist, WorkloadPoint } from "@/types";

export default function DashboardPage() {
  const orgId = useActiveOrgId();
  const me = useMe();
  const orgs = useOrganizations();
  const router = useRouter();

  // First-run detection: signed-in users with no workspace go through onboarding.
  React.useEffect(() => {
    if (!me.isLoading && me.data && !orgs.isLoading && orgs.isSuccess && orgs.data.length === 0) {
      router.replace("/onboarding");
    }
  }, [me.isLoading, me.data, orgs.isLoading, orgs.isSuccess, orgs.data, router]);
  const summary = useQuery({
    queryKey: qk.analyticsSummary(orgId ?? "x"),
    queryFn: () => apiFetch<{ summary: AnalyticsSummaryDTO }>(`/api/analytics/summary?orgId=${orgId}`),
    enabled: Boolean(orgId),
  });
  const projects = useQuery({
    queryKey: qk.projects(orgId ?? "x", "dash"),
    queryFn: () =>
      apiFetch<{ items: ProjectSummaryDTO[]; total: number }>(
        `/api/projects${qs({ orgId, pageSize: 8, sort: "updated" })}`
      ),
    enabled: Boolean(orgId),
  });
  const activity = useQuery({
    queryKey: qk.activity(orgId ?? "x", "dash"),
    queryFn: () =>
      apiFetch<{ items: ActivityDTO[] }>(`/api/activity${qs({ orgId, pageSize: 8 })}`),
    enabled: Boolean(orgId),
  });
  const trends = useQuery({
    queryKey: qk.analyticsTrends(orgId ?? "x", 14),
    queryFn: () => apiFetch<{ items: TrendPoint[] }>(`/api/analytics/trends?orgId=${orgId}&days=14`),
    enabled: Boolean(orgId),
    retry: false,
  });
  const distributions = useQuery({
    queryKey: qk.analyticsDistributions(orgId ?? "x"),
    queryFn: () => apiFetch<{ priority: PriorityDist[]; status: StatusDist[] }>(`/api/analytics/distributions?orgId=${orgId}`),
    enabled: Boolean(orgId),
    retry: false,
  });
  const workload = useQuery({
    queryKey: qk.analyticsWorkload(orgId ?? "x"),
    queryFn: () => apiFetch<{ items: WorkloadPoint[] }>(`/api/analytics/workload?orgId=${orgId}`),
    enabled: Boolean(orgId),
    retry: false,
  });

  if (!orgId) return null;
  const loading = summary.isLoading && projects.isLoading;
  const error = summary.error ?? projects.error;

  if (error) {
    return (
      <ErrorState
        title="Couldn't load your dashboard"
        message={apiErrorMessage(error)}
        onRetry={() => {
          void summary.refetch();
          void projects.refetch();
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <GreetingSkeleton />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <CardSkeleton key={i} />)}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <CardSkeleton className="lg:col-span-2" />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  const s = summary.data?.summary;
  const items = projects.data?.items ?? [];
  const trendGated = isPlanRequired(trends.error);
  const distGated = isPlanRequired(distributions.error);
  const loadGated = isPlanRequired(workload.error);

  const upcoming = items
    .filter((p) => p.upcomingDeadline && p.status === "active")
    .sort((a, b) => (a.upcomingDeadline ?? "").localeCompare(b.upcomingDeadline ?? ""))
    .slice(0, 5);
  const overdueTotal = items.reduce((sum, p) => sum + p.overdueTasks, 0);

  return (
    <div className="space-y-6">
      <Greeting
        orgName={""}
        openTasks={s?.tasks.open ?? 0}
        overdueTotal={overdueTotal}
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={<FolderKanban className="size-4" />}
          label="Projects"
          value={s ? String(s.projects.active) : "–"}
          hint={`${s?.projects.total ?? 0} total`}
          href="/projects"
        />
        <StatCard
          icon={<ListTodo className="size-4" />}
          label="Open tasks"
          value={s ? String(s.tasks.open) : "–"}
          hint={`${s?.tasks.completed ?? 0} completed`}
          href="/tasks"
        />
        <StatCard
          icon={<AlertCircle className="size-4" />}
          label="Overdue"
          value={s ? String(s.tasks.overdue) : "–"}
          hint="need attention"
          tone={s && s.tasks.overdue > 0 ? "warn" : "default"}
          href="/tasks?due=overdue"
        />
        <StatCard
          icon={<Users className="size-4" />}
          label="Members"
          value={s ? String(s.members.total) : "–"}
          hint={`${s?.members.activeToday ?? 0} active today`}
          href="/settings/members"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Trend chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-sm">Task activity</CardTitle>
              <CardDescription>Created vs completed, last 14 days</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {trendGated ? (
              <PlanGateCard orgId={orgId} compact />
            ) : trends.data?.items ? (
              <TrendAreaChart data={trends.data.items} />
            ) : (
              <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
                No task activity in the last two weeks.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Open tasks by priority</CardTitle>
          </CardHeader>
          <CardContent>
            {distGated ? (
              <PlanGateCard orgId={orgId} compact />
            ) : distributions.data?.priority.length ? (
              <>
                <DonutChart
                  height={170}
                  centerLabel={String(distributions.data.priority.reduce((a, p) => a + p.count, 0))}
                  data={distributions.data.priority.map((p, i) => ({
                    key: p.priority,
                    label: p.priority || "none",
                    value: p.count,
                    color: PIE_COLORS[i % PIE_COLORS.length],
                  }))}
                />
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                  {distributions.data.priority.map((p, i) => (
                    <span key={p.priority} className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <span className="size-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      {p.priority || "none"} · {p.count}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p className="flex h-[170px] items-center justify-center text-sm text-muted-foreground">
                No open tasks yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Project progress */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-sm">Project progress</CardTitle>
              <CardDescription>Active projects across the workspace</CardDescription>
            </div>
            <Link href="/projects" className="flex items-center text-xs font-medium text-primary hover:underline">
              View all <ArrowUpRight className="ml-0.5 size-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.filter((p) => p.status === "active").length === 0 ? (
              <EmptyState
                icon={FolderKanban}
                title="No active projects"
                description="Create a project to start tracking work."
                action={
                  <Link href="/projects" className="text-sm font-medium text-primary hover:underline">
                    Create your first project →
                  </Link>
                }
                compact
              />
            ) : (
              items
                .filter((p) => p.status === "active")
                .map((p) => (
                  <Link key={p.id} href={`/projects/${p.id}`} className="group block">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span
                          aria-hidden
                          className="size-2.5 shrink-0 rounded-sm"
                          style={{ background: p.color ?? "#94a3b8" }}
                        />
                        <span className="truncate text-sm font-medium group-hover:text-primary">{p.name}</span>
                        {p.overdueTasks > 0 ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertCircle className="size-3" /> {p.overdueTasks} overdue
                          </Badge>
                        ) : null}
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {p.openTasks} open · {p.completedTasks} done
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-3">
                      <Progress value={p.progress} className="h-1.5" />
                      <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{p.progress}%</span>
                    </div>
                  </Link>
                ))
            )}
          </CardContent>
        </Card>

        {/* Activity */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm">Recent activity</CardTitle>
            <Link href="/activity" className="text-xs font-medium text-primary hover:underline">
              See all
            </Link>
          </CardHeader>
          <CardContent className="divide-y pt-1">
            {activity.data?.items.length ? (
              activity.data.items.map((a) => <ActivityItem key={a.id} entry={a} compact />)
            ) : (
              <EmptyState icon={CircleDot} title="No activity yet" description="Actions across your workspace will appear here." compact />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Workload + Upcoming */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Team workload</CardTitle>
            <CardDescription>Open and in-progress tasks per member</CardDescription>
          </CardHeader>
          <CardContent>
            {loadGated ? (
              <PlanGateCard orgId={orgId} compact />
            ) : workload.data?.items.length ? (
              <BarDistributionChart
                data={workload.data.items.map((w) => ({
                  label: w.user.name.split(" ")[0] ?? w.user.name,
                  value: w.open + w.inProgress,
                }))}
              />
            ) : (
              <p className="flex h-[150px] items-center justify-center text-sm text-muted-foreground">
                Assign tasks to see workload per member.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Upcoming deadlines</CardTitle>
            <CardDescription>Next project due dates</CardDescription>
          </CardHeader>
          <CardContent>
            {upcoming.length ? (
              <ul className="space-y-2">
                {upcoming.map((p) => (
                  <li key={p.id}>
                    <Link href={`/projects/${p.id}`} className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-accent">
                      <span className="truncate text-[13px] font-medium">{p.name}</span>
                      <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                        {p.upcomingDeadline ? formatDate(p.upcomingDeadline) : ""}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <CheckCircle2 className="size-4 text-success" /> Nothing due soon.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Free plan nudge */}
      {!trendGated && !distGated && s && s.projects.total === 0 ? (
        <Card>
          <CardContent className="flex items-center gap-3 py-5">
            <Sparkles className="size-5 text-primary" />
            <p className="flex-1 text-sm text-muted-foreground">
              Create your first project to unlock the full dashboard — charts populate with real data as your team works.
            </p>
            <Link href="/projects" className="text-sm font-semibold text-primary hover:underline">
              New project →
            </Link>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Greeting({ orgName, openTasks, overdueTotal }: { orgName: string; openTasks: number; overdueTotal: number }) {
  const hour = new Date().getHours();
  const part = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return (
    <div>
      <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
        {part}
        {orgName ? `, ${orgName}` : ""}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {openTasks > 0 ? (
          <>
            You have <span className="font-medium text-foreground">{openTasks} open tasks</span> across your workspace
            {overdueTotal > 0 ? (
              <>
                {" "}— <span className="font-medium text-destructive">{overdueTotal} overdue</span>
              </>
            ) : null}
            .
          </>
        ) : (
          "No open tasks — enjoy the calm before the next sprint."
        )}
      </p>
    </div>
  );
}

function GreetingSkeleton() {
  return (
    <div>
      <div className="h-7 w-64 animate-pulse rounded bg-secondary" />
      <div className="mt-2 h-4 w-96 max-w-full animate-pulse rounded bg-secondary/70" />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  href,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  href: string;
  tone?: "default" | "warn";
}) {
  return (
    <Link href={href} className="group rounded-lg border bg-card p-4 shadow-xs transition-colors hover:border-primary/40">
      <div className="flex items-center justify-between">
        <span className={cn("flex size-8 items-center justify-center rounded-md", tone === "warn" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary")}>
          {icon}
        </span>
        <ArrowUpRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
      </div>
      <p className={cn("mt-3 text-2xl font-bold tabular-nums tracking-tight", tone === "warn" && "text-destructive")}>{value}</p>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground/70">{hint}</p> : null}
    </Link>
  );
}
