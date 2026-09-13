"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Archive,
  ArchiveRestore,
  CalendarClock,
  CheckCircle2,
  FolderKanban,
  MoreHorizontal,
  Plus,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import { apiFetch, qs } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { useActiveOrg } from "@/lib/hooks/use-session";
import { apiErrorMessage } from "@/components/features/error-handling";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/controls";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { Pagination } from "@/components/ui/pagination";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NewProjectDialog } from "@/components/features/new-project-dialog";
import { ConfirmDialog, ConfirmDialogContent } from "@/components/ui/confirm-dialog";
import { useArchiveProject, useDeleteProject, useFavoriteProject } from "@/lib/hooks/projects";
import { formatDate, cn } from "@/lib/utils";
import { toast } from "sonner";
import type { ProjectSummaryDTO } from "@/types";

const PAGE_SIZE = 12;

export default function ProjectsPage() {
  return (
    <React.Suspense>
      <ProjectsInner />
    </React.Suspense>
  );
}

function ProjectsInner() {
  const { activeOrgId: orgId } = useActiveOrg();
  const router = useRouter();
  const sp = useSearchParams();
  const status = (sp.get("status") as "active" | "archived" | "all") ?? "active";
  const q = sp.get("q") ?? "";
  const sort = sp.get("sort") ?? "updated";
  const page = Math.max(1, Number(sp.get("page") ?? "1"));

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(sp.toString());
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    if (key !== "page") next.delete("page");
    router.replace(`/projects?${next.toString()}`);
  };

  const list = useQuery({
    queryKey: qk.projects(orgId ?? "x", `${status}|${q}|${sort}|${page}`),
    queryFn: () =>
      apiFetch<{ items: ProjectSummaryDTO[]; total: number; hasMore: boolean }>(
        `/api/projects${qs({ orgId, page, pageSize: PAGE_SIZE, q: q || undefined, status, sort })}`
      ),
    enabled: Boolean(orgId),
  });

  const archive = useArchiveProject(orgId ?? "");
  const favorite = useFavoriteProject(orgId ?? "");
  const remove = useDeleteProject(orgId ?? "");
  const [toDelete, setToDelete] = React.useState<ProjectSummaryDTO | null>(null);

  if (!orgId) return null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Projects</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {list.data ? (
              <>
                {list.data.total} project{list.data.total === 1 ? "" : "s"}
                {status === "archived" ? " (archived)" : ""}
              </>
            ) : (
              "Track the work that matters"
            )}
          </p>
        </div>
        <NewProjectDialog orgId={orgId} trigger={<Button><Plus /> New project</Button>} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border bg-card p-0.5" role="tablist" aria-label="Project status filter">
          {(
            [
              ["active", "Active"],
              ["archived", "Archived"],
              ["all", "All"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={status === key}
              onClick={() => setParam("status", key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                status === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={q}
            onChange={(e) => setParam("q", e.target.value)}
            placeholder="Search projects…"
            className="pl-8"
            aria-label="Search projects"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setParam("sort", e.target.value)}
          aria-label="Sort projects"
          className="h-9 rounded-md border bg-card px-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="updated">Recently updated</option>
          <option value="created">Recently created</option>
          <option value="name">Name A–Z</option>
          <option value="dueDate">Upcoming due date</option>
        </select>
      </div>

      {list.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} className="h-44" />
          ))}
        </div>
      ) : list.isError ? (
        <ErrorState
          title="Couldn't load projects"
          message={apiErrorMessage(list.error)}
          onRetry={() => void list.refetch()}
        />
      ) : list.data!.items.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={q || status !== "active" ? "No projects match" : "No projects yet"}
          description={
            q || status !== "active"
              ? "Try adjusting the search or filters."
              : "Create a project to organize tasks, sprints and milestones."
          }
          action={
            q || status !== "active" ? (
              <Button variant="outline" onClick={() => router.replace("/projects")}>
                Clear filters
              </Button>
            ) : (
              <NewProjectDialog orgId={orgId} />
            )
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.data!.items.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              canDelete={p.myRole === "manager"}
              onToggleFavorite={() => favorite.mutate(p.id)}
              onArchive={() =>
                archive.mutate(
                  { projectId: p.id, archived: p.status === "active" },
                  { onSuccess: () => toast.success(p.status === "active" ? "Project archived" : "Project restored") }
                )
              }
              onRequestDelete={() => setToDelete(p)}
            />
          ))}
        </div>
      )}

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={list.data?.total ?? 0}
        onPageChange={(p) => setParam("page", String(p))}
      />

      <ConfirmDialog open={Boolean(toDelete)} onOpenChange={(o) => !o && setToDelete(null)}>
        <ConfirmDialogContent
          title="Delete project?"
          description={
            toDelete ? (
              <>
                Permanently delete <span className="font-semibold">{toDelete.name}</span> and all of its tasks,
                comments and sprints? This cannot be undone.
              </>
            ) : (
              ""
            )
          }
          confirmLabel="Delete project"
          destructive
          loading={remove.isPending}
          onConfirm={() => {
            if (!toDelete) return;
            remove.mutate(toDelete.id, {
              onSuccess: () => {
                toast.success("Project deleted");
                setToDelete(null);
              },
            });
          }}
        />
      </ConfirmDialog>
    </div>
  );
}

function ProjectCard({
  project: p,
  canDelete,
  onToggleFavorite,
  onArchive,
  onRequestDelete,
}: {
  project: ProjectSummaryDTO;
  canDelete: boolean;
  onToggleFavorite: () => void;
  onArchive: () => void;
  onRequestDelete: () => void;
}) {
  const overdue = p.overdueTasks > 0 && p.status === "active";
  return (
    <Card className="group relative flex flex-col gap-3 overflow-hidden p-4 transition-shadow hover:shadow-md">
      <div aria-hidden className="absolute inset-x-0 top-0 h-0.5" style={{ background: p.color ?? "#64748b" }} />
      <div className="flex items-start gap-2">
        <Link href={`/projects/${p.id}`} className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[15px] font-semibold group-hover:text-primary">{p.name}</h3>
            {p.status === "archived" ? <Badge variant="muted">Archived</Badge> : null}
          </div>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-mono">{p.key}</span>
            {p.upcomingDeadline ? (
              <span className="flex items-center gap-0.5">
                · <CalendarClock className="size-3" /> {formatDate(p.upcomingDeadline)}
              </span>
            ) : null}
          </p>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${p.name}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onToggleFavorite}>
              <Star className={cn(p.isFavorite && "fill-amber-400 text-amber-400")} />
              {p.isFavorite ? "Remove from favorites" : "Add to favorites"}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onArchive}>
              {p.status === "active" ? <Archive /> : <ArchiveRestore />}
              {p.status === "active" ? "Archive project" : "Restore project"}
            </DropdownMenuItem>
            {canDelete ? (
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  onRequestDelete();
                }}
                danger
              >
                <Trash2 /> Delete project
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {p.description ? (
        <p className="line-clamp-2 min-h-[2.25rem] text-[13px] leading-snug text-muted-foreground">{p.description}</p>
      ) : null}

      <div className="mt-auto space-y-2">
        <div className="flex items-center gap-2">
          <Progress value={p.progress} className="h-1.5" />
          <span className="text-xs tabular-nums text-muted-foreground">{p.progress}%</span>
        </div>
        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <FolderKanban className="size-3.5" aria-hidden /> {p.openTasks}
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="size-3.5" aria-hidden /> {p.completedTasks}
            </span>
            {overdue ? <Badge variant="destructive">! {p.overdueTasks} overdue</Badge> : null}
          </div>
          {p.ownerName ? (
            <span className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="flex size-5 items-center justify-center rounded-full bg-primary/15 text-[9px] font-bold text-primary"
              >
                {p.ownerName.charAt(0).toUpperCase()}
              </span>
              <span className="max-w-[90px] truncate">{p.ownerName}</span>
            </span>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
