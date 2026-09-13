"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlarmClock, CalendarDays, Play, Square, Timer, Trash2 } from "lucide-react";
import { apiFetch, qs } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { useActiveOrgId } from "@/lib/hooks/use-session";
import { apiErrorMessage } from "@/components/features/error-handling";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { Avatar } from "@/components/ui/avatar";
import { Pagination } from "@/components/ui/pagination";
import { ConfirmDialog, ConfirmDialogContent } from "@/components/ui/confirm-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTime, formatDuration, dateToInput } from "@/lib/utils";
import { toast } from "sonner";
import type { TimeEntryDTO, ProjectSummaryDTO } from "@/types";

interface TimeReportShape {
  items: TimeEntryDTO[];
  total: number;
  totalMs: number;
  hasMore: boolean;
  perUser: { userId: string; totalMs: number }[];
}

export default function TimePage() {
  const orgId = useActiveOrgId();
  const [from, setFrom] = React.useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [to, setTo] = React.useState(() => new Date());
  const [projectId, setProjectId] = React.useState("__all");
  const [page, setPage] = React.useState(1);
  const PAGE_SIZE = 25;

  const report = useQuery({
    queryKey: qk.timeReport(orgId ?? "x", `${from.toISOString()}|${to.toISOString()}|${projectId}|${page}`),
    queryFn: () =>
      apiFetch<TimeReportShape>(
        `/api/time-entries${qs({
          orgId,
          from: from.toISOString(),
          to: to.toISOString(),
          projectId: projectId === "__all" ? undefined : projectId,
          page,
          pageSize: PAGE_SIZE,
        })}`
      ),
    enabled: Boolean(orgId),
  });
  const running = useQuery({
    queryKey: qk.runningTimer(orgId ?? "x"),
    queryFn: () => apiFetch<{ running: RunningShape | null }>(`/api/time-entries/running?orgId=${orgId}`),
    enabled: Boolean(orgId),
    refetchInterval: 60_000,
  });
  const projects = useQuery({
    queryKey: qk.projects(orgId ?? "x", "time"),
    queryFn: () => apiFetch<{ items: ProjectSummaryDTO[] }>(`/api/projects${qs({ orgId, pageSize: 100, status: "all" })}`),
    enabled: Boolean(orgId),
  });

  const qc = useQueryClient();
  const stopTimer = useMutation({
    mutationFn: () => apiFetch("/api/time-entries/stop", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["runningTimer"] });
      qc.invalidateQueries({ queryKey: ["time"] });
      toast.success("Timer stopped");
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const deleteEntry = useMutation({
    mutationFn: (entry: TimeEntryDTO) =>
      apiFetch(`/api/projects/${entry.projectId}/tasks/${entry.taskId}/time-entries/${entry.id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["time"] });
      toast.success("Entry deleted");
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const [toDelete, setToDelete] = React.useState<TimeEntryDTO | null>(null);

  const run = running.data?.running ?? null;
  const [elapsed, setElapsed] = React.useState(0);
  React.useEffect(() => {
    if (!run?.startAt) return;
    const tick = () => setElapsed(Date.now() - new Date(run.startAt).getTime());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [run?.id, run?.startAt]);

  if (!orgId) return null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Time</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Tracked time across tasks and projects.</p>
      </div>

      {/* Running timer banner */}
      {run ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-success/30 bg-success/5 px-4 py-3">
          <Timer className="size-5 text-success" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              Tracking{" "}
              <Link href={`/projects/${run.projectId}/board?task=${run.taskId}`} className="text-primary hover:underline">
                {run.taskKey}
              </Link>{" "}
              · <span className="font-mono tabular-nums">{formatDuration(elapsed)}</span>
            </p>
            <p className="text-xs text-muted-foreground">started {formatDateTime(run.startAt)}</p>
          </div>
          <Button size="sm" variant="outline" className="border-red-500/40 text-red-600 hover:bg-red-500/10" onClick={() => stopTimer.mutate()} loading={stopTimer.isPending}>
            <Square className="size-3 fill-current" /> Stop
          </Button>
        </div>
      ) : null}

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <label className="space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground">From</span>
            <Input type="date" value={dateToInput(from)} onChange={(e) => e.target.value && setFrom(new Date(e.target.value))} className="w-40" />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground">To</span>
            <Input type="date" value={dateToInput(to)} onChange={(e) => e.target.value && setTo(new Date(e.target.value))} className="w-40" />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground">Project</span>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="w-48" aria-label="Project filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">All projects</SelectItem>
                {(projects.data?.items ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <Button variant="outline" size="sm" onClick={() => { const d = new Date(); d.setDate(1); setFrom(d); setTo(new Date()); }}>
            This month
          </Button>
          <div className="ml-auto text-right">
            <p className="text-[11px] text-muted-foreground">Total in range</p>
            <p className="text-lg font-bold tabular-nums">{formatDuration(report.data?.totalMs ?? 0)}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div>
          {report.isLoading ? (
            <CardSkeleton className="h-72" />
          ) : report.isError ? (
            <ErrorState title="Couldn't load time entries" message={apiErrorMessage(report.error)} onRetry={() => void report.refetch()} />
          ) : report.data!.items.length === 0 ? (
            <EmptyState
              icon={AlarmClock}
              title="No time logged in this range"
              description="Start the timer from any task to track work automatically, or add manual entries."
            />
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Entries</CardTitle>
              </CardHeader>
              <CardContent className="divide-y px-0 pb-1">
                {report.data!.items.map((e) => (
                  <div key={e.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5">
                    <Avatar name={e.user.name} src={e.user.avatarUrl} size="sm" />
                    <div className="min-w-0 flex-1">
                      <Link href={`/projects/${e.projectId}/board?task=${e.taskId}`} className="block truncate text-[13px] font-medium hover:text-primary">
                        {e.taskKey} · {e.taskTitle}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {e.projectName}
                        {e.description ? ` · ${e.description}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">{formatDuration(e.durationMs)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {e.source === "timer" ? <Timer className="mr-1 inline size-3" /> : <Play className="mr-1 inline size-3" />}
                        {formatDateTime(e.startAt)}
                      </p>
                    </div>
                    {e.canDelete ? (
                      <Button variant="ghost" size="icon-sm" aria-label="Delete entry" className="text-muted-foreground hover:text-destructive" onClick={() => setToDelete(e)}>
                        <Trash2 />
                      </Button>
                    ) : null}
                  </div>
                ))}
              </CardContent>
              <div className="px-5 pb-3 pt-1">
                <Pagination page={page} pageSize={PAGE_SIZE} total={report.data!.total} onPageChange={setPage} />
              </div>
            </Card>
          )}
        </div>

        {/* Per-user totals */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm"><CalendarDays className="mr-1.5 inline size-4 text-muted-foreground" /> By member</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {report.data?.perUser.length ? (
              report.data.perUser.map((u) => {
                const name = report.data?.items.find((i) => i.user.userId === u.userId)?.user.name ?? "Team member";
                return (
                  <div key={u.userId} className="flex items-center justify-between text-[13px]">
                    <span className="truncate">{name}</span>
                    <span className="font-medium tabular-nums">{formatDuration(u.totalMs)}</span>
                  </div>
                );
              })
            ) : (
              <p className="text-[13px] text-muted-foreground">No data in range.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog open={Boolean(toDelete)} onOpenChange={(o) => !o && setToDelete(null)}>
        <ConfirmDialogContent
          title="Delete time entry?"
          description="This removes the logged time from the task totals."
          confirmLabel="Delete"
          destructive
          loading={deleteEntry.isPending}
          onConfirm={() => toDelete && deleteEntry.mutate(toDelete)}
        />
      </ConfirmDialog>
    </div>
  );
}

type RunningShape = {
  id: string;
  taskId: string;
  taskKey: string;
  taskTitle: string;
  projectId: string;
  startAt: string;
};
