"use client";

import * as React from "react";
import Link from "next/link";
import { useQueries, useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Inbox, ListTodo } from "lucide-react";
import { apiFetch, qs } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { useActiveOrgId, useMe } from "@/lib/hooks/use-session";
import { apiErrorMessage } from "@/components/features/error-handling";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { formatDate } from "@/lib/utils";
import type { ProjectSummaryDTO, TaskDTO } from "@/types";

const PRIO: Record<string, string> = {
  urgent: "bg-red-500/15 text-red-600 dark:text-red-400",
  high: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  medium: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  low: "bg-muted text-muted-foreground",
  none: "text-muted-foreground",
};

/** Cross-project view of tasks assigned to me (each project queried separately). */
export default function MyTasksPage() {
  const orgId = useActiveOrgId();
  const me = useMe();

  const projects = useQuery({
    queryKey: qk.projects(orgId ?? "x", "all-for-mytasks"),
    queryFn: () =>
      apiFetch<{ items: ProjectSummaryDTO[]; total: number }>(`/api/projects${qs({ orgId, pageSize: 100, status: "active" })}`),
    enabled: Boolean(orgId),
  });

  const perProject = useQueries({
    queries: (projects.data?.items ?? []).map((p) => ({
      queryKey: ["mytasks", orgId, p.id, me.data?.user?.id],
      queryFn: () =>
        apiFetch<{ items: TaskDTO[]; total: number; hasMore: boolean }>(
          `/api/projects/${p.id}/tasks${qs({
            orgId,
            pageSize: 100,
            assigneeId: me.data?.user?.id,
            statuses: undefined,
            sort: "dueDate",
          })}`
        ).then((d) => ({ project: p, ...d })),
      enabled: Boolean(orgId && me.data?.user?.id),
    })),
  });

  const loading = projects.isLoading || perProject.some((q) => q.isLoading);
  const error = projects.error;
  const meId = me.data?.user?.id;

  if (!orgId || !meId) return null;

  if (error)
    return <ErrorState title="Couldn't load your tasks" message={apiErrorMessage(error)} onRetry={() => void projects.refetch()} />;

  const sections = perProject.filter((q) => q.data && (q.data.items.length > 0 || q.data.total > 0)) as {
    data: { project: ProjectSummaryDTO; items: TaskDTO[]; total: number };
  }[];
  const totalMine = sections.reduce((n, s) => n + s.data.total, 0);
  const dueSorted = sections
    .flatMap((s) => s.data.items.map((t) => ({ ...t, _project: s.data.project })))
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">My tasks</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {loading ? "Loading…" : `${totalMine} task${totalMine === 1 ? "" : "s"} assigned to you across active projects`}
        </p>
      </div>

      {loading ? (
        <CardSkeleton className="h-64" />
      ) : sections.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Nothing assigned to you"
          description="When someone assigns you a task it shows up here with its due date, so you never miss a deadline."
          action={
            projects.data?.items.length ? (
              <Link href="/projects" className="text-sm font-medium text-primary hover:underline">
                Browse projects →
              </Link>
            ) : undefined
          }
        />
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              <ListTodo className="mr-1.5 inline size-4 text-muted-foreground" /> Upcoming first
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {dueSorted.map((t) => {
              const overdue = t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "done";
              return (
                <Link
                  key={t.id}
                  href={`/projects/${t.projectId}/board?task=${t.id}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-2 py-2.5 hover:bg-accent/60"
                >
                  <span className="w-20 shrink-0 font-mono text-[11px] text-muted-foreground">{t.key}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{t.title}</span>
                  <span className="shrink-0 rounded-md bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {t._project.name}
                  </span>
                  {t.status === "done" ? (
                    <Badge variant="muted" className="gap-1"><CheckCircle2 className="size-3" /> Done</Badge>
                  ) : t.dueDate ? (
                    <span
                      className={`flex shrink-0 items-center gap-1 text-[11px] tabular-nums ${overdue ? "font-semibold text-destructive" : "text-muted-foreground"}`}
                    >
                      {overdue ? <AlertCircle className="size-3" /> : null}
                      {formatDate(t.dueDate)}
                    </span>
                  ) : null}
                  <Badge variant="muted" className={`shrink-0 capitalize ${PRIO[t.priority] ?? PRIO.none}`}>
                    {t.priority === "none" ? "No priority" : t.priority}
                  </Badge>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
