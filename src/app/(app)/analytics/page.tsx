"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Zap } from "lucide-react";
import { apiFetch, qs } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { useActiveOrgId } from "@/lib/hooks/use-session";
import { apiErrorMessage, isPlanRequired } from "@/components/features/error-handling";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ErrorState, EmptyState } from "@/components/ui/state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendAreaChart, DonutChart, BarDistributionChart, PIE_COLORS } from "@/components/features/charts";
import { PlanGateCard } from "@/components/features/plan-gate";
import { formatDuration } from "@/lib/utils";
import type { AnalyticsSummaryDTO, TrendPoint, PriorityDist, StatusDist, WorkloadPoint } from "@/types";

export default function AnalyticsPage() {
  const orgId = useActiveOrgId();
  const [days, setDays] = React.useState(14);

  const summary = useQuery({
    queryKey: qk.analyticsSummary(orgId ?? "x"),
    queryFn: () => apiFetch<{ summary: AnalyticsSummaryDTO }>(`/api/analytics/summary?orgId=${orgId}`),
    enabled: Boolean(orgId),
  });
  const trends = useQuery({
    queryKey: qk.analyticsTrends(orgId ?? "x", days),
    queryFn: () => apiFetch<{ items: TrendPoint[] }>(`/api/analytics/trends?orgId=${orgId}&days=${days}`),
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
  const loading = summary.isLoading;
  const error = summary.error;

  if (error)
    return <ErrorState title="Couldn't load analytics" message={apiErrorMessage(error)} onRetry={() => void summary.refetch()} />;
  if (loading) {
    return (
      <div className="space-y-4">
        <CardSkeleton className="h-24" />
        <div className="grid gap-4 lg:grid-cols-2"><CardSkeleton className="h-72" /><CardSkeleton className="h-72" /></div>
      </div>
    );
  }

  const s = summary.data?.summary;
  const trendGated = isPlanRequired(trends.error);
  const distGated = isPlanRequired(distributions.error);
  const loadGated = isPlanRequired(workload.error);

  const statusData: { label: string; value: number }[] = (distributions.data?.status ?? []).map((x) => ({
    label: x.label,
    value: x.count,
  }));
  const priorityData = distributions.data?.priority ?? [];
  const workloadData = workload.data?.items ?? [];

  const cycle = s?.tasks.avgCycleDays;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Analytics</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Real signals from your board — cycle time, throughput, workload.
          </p>
        </div>
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger aria-label="Trend window" className="w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="14">Last 14 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryTile label="Completion rate" value={s ? `${s.tasks.completionRate}%` : "–"} sub={s ? `${s.tasks.completed} of ${s.tasks.total} tasks` : ""} />
        <SummaryTile label="Avg cycle time" value={cycle != null ? formatDuration(cycle * 86400000) : "—"} sub="open → done" />
        <SummaryTile label="Overdue tasks" value={String(s?.tasks.overdue ?? "–")} sub="across all projects" tone={(s?.tasks.overdue ?? 0) > 0 ? "warn" : "ok"} />
        <SummaryTile label="Active sprints" value={String(s?.sprints.active ?? "–")} sub={`${s?.sprints.total ?? 0} total · ${s?.sprints.completed ?? 0} completed`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Throughput</CardTitle>
            <CardDescription>Tasks created vs completed per day</CardDescription>
          </CardHeader>
          <CardContent>
            {trendGated ? (
              <PlanGateCard orgId={orgId} />
            ) : trends.data?.items?.length ? (
              <TrendAreaChart data={trends.data.items} height={260} />
            ) : (
              <p className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                No activity in this window yet.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Open tasks by priority</CardTitle>
            <CardDescription>What&apos;s on the plate right now</CardDescription>
          </CardHeader>
          <CardContent>
            {distGated ? (
              <PlanGateCard orgId={orgId} compact />
            ) : priorityData.length ? (
              <>
                <DonutChart
                  height={190}
                  centerLabel={String(priorityData.reduce((n, p) => n + p.count, 0))}
                  data={priorityData.map((p, i) => ({ key: p.priority, label: p.priority || "none", value: p.count, color: PIE_COLORS[i % PIE_COLORS.length] }))}
                />
                <ul className="mt-1 space-y-1">
                  {priorityData.map((p, i) => (
                    <li key={p.priority} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-muted-foreground capitalize">
                        <span aria-hidden className="size-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        {p.priority || "none"}
                      </span>
                      <span className="font-medium tabular-nums">{p.count}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="flex h-48 items-center justify-center text-sm text-muted-foreground">No open tasks.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Tasks by status</CardTitle>
            <CardDescription>Where work lives on your boards</CardDescription>
          </CardHeader>
          <CardContent>
            {distGated ? (
              <PlanGateCard orgId={orgId} compact />
            ) : statusData.length ? (
              <BarDistributionChart data={statusData} color="var(--chart-4)" height={240} />
            ) : (
              <p className="flex h-52 items-center justify-center text-sm text-muted-foreground">No tasks yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="text-sm">Team workload</CardTitle>
              <CardDescription>Open + in-progress per member</CardDescription>
            </div>
            <Badge variant="muted" className="gap-1"><Zap className="size-3" /> live</Badge>
          </CardHeader>
          <CardContent>
            {loadGated ? (
              <PlanGateCard orgId={orgId} compact />
            ) : workloadData.length ? (
              <>
                <BarDistributionChart
                  data={workloadData.map((w) => ({
                    label: w.user.name.split(" ")[0] ?? w.user.name,
                    value: w.open + w.inProgress,
                  }))}
                  color="var(--chart-2)"
                  height={200}
                />
                <ul className="mt-2 space-y-1">
                  {workloadData.map((w) => (
                    <li key={w.user.userId} className="flex items-center justify-between text-xs">
                      <span className="truncate text-muted-foreground">{w.user.name}</span>
                      <span className="tabular-nums">
                        <span className="font-medium">{w.open + w.inProgress} open</span>
                        {" · "}
                        <span className="text-muted-foreground">{w.completed} done</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <EmptyState icon={TrendingUp} title="No assignments yet" description="Assign tasks to team members to see workload here." compact />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SummaryTile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "ok" | "warn" }) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-xs">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums tracking-tight ${tone === "warn" ? "text-destructive" : ""}`}>{value}</p>
      {sub ? <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}
