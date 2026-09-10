"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowUpRight,
  Archive,
  ArchiveRestore,
  CalendarClock,
  CheckCircle2,
  KanbanSquare,
  ListTodo,
  MoreHorizontal,
  Settings,
  Star,
  Tag,
  Trash2,
  Users,
} from "lucide-react";
import { apiFetch, qs } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { useActiveOrgId } from "@/lib/hooks/use-session";
import { apiErrorMessage } from "@/components/features/error-handling";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/controls";
import { EmptyState, ErrorState } from "@/components/ui/state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog, ConfirmDialogContent } from "@/components/ui/confirm-dialog";
import { useArchiveProject, useDeleteProject, useFavoriteProject } from "@/lib/hooks/projects";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import type { ProjectDetailDTO, TaskDTO } from "@/types";

const PRIORITY_META: Record<string, { label: string; cls: string }> = {
  urgent: { label: "Urgent", cls: "bg-red-500/15 text-red-600 dark:text-red-400" },
  high: { label: "High", cls: "bg-orange-500/15 text-orange-600 dark:text-orange-400" },
  medium: { label: "Medium", cls: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
  low: { label: "Low", cls: "bg-slate-400/20 text-muted-foreground" },
  none: { label: "None", cls: "text-muted-foreground" },
};

export default function ProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const orgId = useActiveOrgId();
  const router = useRouter();

  const detail = useQuery({
    queryKey: qk.project(orgId ?? "x", projectId),
    queryFn: () =>
      apiFetch<{ project: ProjectDetailDTO }>(
        `/api/projects/${projectId}?orgId=${encodeURIComponent(orgId ?? "")}`
      ),
    enabled: Boolean(orgId),
  });

  const tasks = useQuery({
    queryKey: qk.tasks(orgId ?? "x", projectId, "recent5"),
    queryFn: () =>
      apiFetch<{ items: TaskDTO[]; total: number; hasMore: boolean }>(
        `/api/projects/${projectId}/tasks${qs({ orgId, page: 1, pageSize: 5, sort: "updated" })}`
      ),
    enabled: Boolean(orgId),
  });

  const archive = useArchiveProject(orgId ?? "");
  const favorite = useFavoriteProject(orgId ?? "");
  const remove = useDeleteProject(orgId ?? "");
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const p = detail.data?.project;

  if (!orgId || !projectId) return null;

  if (detail.isLoading && !p) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-72 animate-pulse rounded bg-secondary" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <CardSkeleton key={i} />)}
        </div>
        <CardSkeleton className="h-64" />
      </div>
    );
  }

  if (detail.isError || !p) {
    return (
      <ErrorState
        title="Couldn't open this project"
        message={apiErrorMessage(detail.error ?? new Error("Project not found."))}
        onRetry={() => void detail.refetch()}
      />
    );
  }

  const isManager = p.myRole === "manager";
  const archived = p.status === "archived";
  const recent = tasks.data?.items ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/projects"
          className="mb-3 inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Projects
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <span aria-hidden className="size-4 rounded-sm" style={{ background: p.color ?? "#64748b" }} />
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{p.name}</h1>
          <Badge variant="muted" className="font-mono">{p.key}</Badge>
          {archived ? <Badge variant="secondary">Archived</Badge> : null}
          {p.isFavorite ? <Badge variant="secondary">★ Favorite</Badge> : null}
          <div className="ml-auto flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              aria-label={p.isFavorite ? "Remove from favorites" : "Add to favorites"}
              onClick={() => favorite.mutate(p.id)}
            >
              <Star className={p.isFavorite ? "fill-amber-400 text-amber-400" : ""} />
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/projects/${p.id}/board`}>
                <KanbanSquare /> Board
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="More actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isManager ? (
                  <DropdownMenuItem onSelect={() => router.push(`/projects/${p.id}/settings`)}>
                    <Settings /> Project settings
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem
                  onSelect={() =>
                    archive.mutate(
                      { projectId: p.id, archived: !archived },
                      { onSuccess: () => toast.success(archived ? "Project restored" : "Project archived") }
                    )
                  }
                >
                  {archived ? <ArchiveRestore /> : <Archive />}
                  {archived ? "Restore project" : "Archive project"}
                </DropdownMenuItem>
                {isManager ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem danger onSelect={() => setDeleteOpen(true)}>
                      <Trash2 /> Delete project
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {p.description ? (
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{p.description}</p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {p.startDate || p.dueDate ? (
            <span className="flex items-center gap-1">
              <CalendarClock className="size-3.5" />
              {p.startDate ? formatDate(p.startDate) : "Start…"} → {p.dueDate ? formatDate(p.dueDate) : "Open end"}
            </span>
          ) : null}
          <span className="flex items-center gap-1"><Users className="size-3.5" /> {p.memberCount} members</span>
          {p.sprintCount ? <span>{p.sprintCount} sprints</span> : null}
          {p.ownerName ? <span>Managed by {p.ownerName}</span> : null}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat icon={<ListTodo className="size-4" />} label="Open tasks" value={String(p.openTasks)} />
        <MiniStat icon={<CheckCircle2 className="size-4" />} label="Completed" value={String(p.completedTasks)} />
        <MiniStat
          label="Progress"
          value={`${p.progress}%`}
          bar
          barValue={p.progress}
        />
        <MiniStat
          icon={<CalendarClock className="size-4" />}
          label="Overdue"
          value={String(p.overdueTasks)}
          tone={p.overdueTasks > 0 ? "danger" : "ok"}
          sub={p.upcomingDeadline ? `next due ${formatDate(p.upcomingDeadline)}` : "no due tasks"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Recent tasks */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-sm">Recently updated tasks</CardTitle>
              <CardDescription>{tasks.data?.total ?? 0} total in {p.name}</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href={`/projects/${p.id}/board`}>
                Open board <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-1">
            {tasks.isLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded-md bg-secondary/60" />)}
              </div>
            ) : recent.length === 0 ? (
              <EmptyState
                icon={ListTodo}
                title="No tasks yet"
                description="Create tasks on the board to start tracking work."
                action={
                  <Button asChild size="sm">
                    <Link href={`/projects/${p.id}/board`}>Go to board</Link>
                  </Button>
                }
                compact
              />
            ) : (
              <ul className="divide-y">
                {recent.map((t) => {
                  const prio = PRIORITY_META[t.priority] ?? PRIORITY_META.none;
                  return (
                    <li key={t.id}>
                      <Link
                        href={`/projects/${p.id}/board?task=${t.id}`}
                        className="flex items-center gap-3 rounded-md px-1 py-2 hover:bg-accent/60"
                      >
                        <span className="w-16 shrink-0 font-mono text-[11px] text-muted-foreground">{t.key}</span>
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{t.title}</span>
                        {t.subtaskCount > 0 ? (
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {t.completedSubtaskCount}/{t.subtaskCount} sub
                          </span>
                        ) : null}
                        {t.dueDate ? (
                          <span
                            className={`shrink-0 text-[11px] ${new Date(t.dueDate) < new Date() && t.status !== "done" ? "font-medium text-destructive" : "text-muted-foreground"}`}
                          >
                            {formatDate(t.dueDate)}
                          </span>
                        ) : null}
                        <Badge variant="muted" className={`shrink-0 ${prio.cls}`}>{prio.label}</Badge>
                        <span className="shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] text-muted-foreground capitalize">
                          {t.status.replace(/_/g, " ")}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Members & labels */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm">Members</CardTitle>
              <span className="text-xs text-muted-foreground">{p.members.length}</span>
            </CardHeader>
            <CardContent className="space-y-2.5 pt-1">
              {p.members.map((m) => (
                <div key={m.userId} className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className="flex size-7 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary"
                  >
                    {m.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px]">{m.name}</span>
                  <span className="text-[11px] text-muted-foreground capitalize">{m.role}</span>
                </div>
              ))}
              {isManager ? (
                <Button asChild variant="outline" size="sm" className="mt-1 w-full">
                  <Link href={`/projects/${p.id}/settings`}>Manage members</Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm">Labels</CardTitle>
              <span className="text-xs text-muted-foreground">{p.labels.length}</span>
            </CardHeader>
            <CardContent className="pt-1">
              {p.labels.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">No labels yet.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {p.labels.map((l) => (
                    <span
                      key={l.id}
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                      style={{ background: `${l.color}1f`, color: l.color }}
                    >
                      <Tag className="size-3" aria-hidden /> {l.name}
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <ConfirmDialogContent
          title="Delete project?"
          description={
            <>
              Permanently delete <span className="font-semibold">{p.name}</span> and all of its tasks, comments
              and sprints? This cannot be undone.
            </>
          }
          confirmLabel="Delete project"
          destructive
          loading={remove.isPending}
          onConfirm={() =>
            remove.mutate(p.id, {
              onSuccess: () => {
                toast.success("Project deleted");
                router.push("/projects");
              },
            })
          }
        />
      </ConfirmDialog>
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
  sub,
  tone,
  bar,
  barValue,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: "ok" | "danger";
  bar?: boolean;
  barValue?: number;
}) {
  return (
    <div className="rounded-lg border bg-card p-3.5 shadow-xs">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="flex items-center gap-1.5 text-xs font-medium">{icon}{label}</span>
        {tone === "danger" ? <span aria-hidden className="size-2 rounded-full bg-destructive" /> : null}
        {tone === "ok" ? <span aria-hidden className="size-2 rounded-full bg-success" /> : null}
      </div>
      <p className={`mt-1.5 text-2xl font-bold tabular-nums tracking-tight ${tone === "danger" ? "text-destructive" : ""}`}>
        {value}
      </p>
      {bar ? <Progress value={barValue} className="mt-1.5 h-1.5" /> : null}
      {sub ? <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}
