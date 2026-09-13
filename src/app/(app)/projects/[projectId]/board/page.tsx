"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Filter, KanbanSquare, ListFilter, X } from "lucide-react";
import { apiFetch, qs } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { useActiveOrgId, useMe } from "@/lib/hooks/use-session";
import { apiErrorMessage } from "@/components/features/error-handling";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/ui/state";
import { CardSkeleton } from "@/components/ui/skeleton";
import { BoardColumn } from "@/components/features/board/board-column";
import { TaskCardView } from "@/components/features/board/task-card";
import { QuickTaskDialog } from "@/components/features/task/quick-task-dialog";
import { TaskDrawer } from "@/components/features/task/task-drawer";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { BoardDTO, TaskDTO, ProjectMemberDTO } from "@/types";

interface FilterState {
  q: string;
  assigneeId: string | null;
  priority: string | null;
  labelId: string | null;
  due: string | null;
}

const EMPTY_FILTERS: FilterState = { q: "", assigneeId: null, priority: null, labelId: null, due: null };

/** Group board tasks into per-status columns, sorted by drag order. */
function buildBoardColumns(data: BoardDTO): Record<string, TaskDTO[]> {
  const grouped: Record<string, TaskDTO[]> = {};
  for (const col of data.statuses) grouped[col.key] = [];
  for (const t of data.tasks) {
    (grouped[t.status] ??= []).push(t);
  }
  for (const k of Object.keys(grouped)) grouped[k].sort((a, b) => a.order - b.order);
  return grouped;
}

export default function BoardPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const orgId = useActiveOrgId();
  const router = useRouter();
  const sp = useSearchParams();
  const taskParam = sp.get("task");

  const [filters, setFilters] = React.useState<FilterState>(EMPTY_FILTERS);
  const [searchDraft, setSearchDraft] = React.useState("");
  // Debounce the text filter so the board isn't refetched per keystroke.
  React.useEffect(() => {
    const h = setTimeout(() => {
      setFilters((f) => (f.q === searchDraft ? f : { ...f, q: searchDraft }));
    }, 300);
    return () => clearTimeout(h);
  }, [searchDraft]);
  const setFilter = (patch: Partial<FilterState>) => setFilters((f) => ({ ...f, ...patch }));
  const [activeTask, setActiveTask] = React.useState<TaskDTO | null>(null);
  // Drawer follows the ?task= URL param (back/forward support).
  const selectedTaskId = taskParam;
  const [createStatus, setCreateStatus] = React.useState<string | null>(null);

  const openTask = (id: string) => router.push(`/projects/${projectId}/board?task=${id}`, { scroll: false });
  const closeTask = () => router.replace(`/projects/${projectId}/board`, { scroll: false });

  const board = useQuery({
    queryKey: qk.board(orgId ?? "x", projectId, `${filters.q}|${filters.assigneeId ?? ""}|${filters.priority ?? ""}|${filters.labelId ?? ""}|${filters.due ?? ""}`),
    queryFn: () =>
      apiFetch<BoardDTO>(
        `/api/projects/${projectId}/board${qs({ orgId, q: filters.q || undefined, assigneeId: filters.assigneeId ?? undefined, priority: filters.priority ?? undefined, labelId: filters.labelId ?? undefined, due: filters.due ?? undefined })}`
      ),
    enabled: Boolean(orgId),
  });

  const detail = useQuery({
    queryKey: qk.project(orgId ?? "x", projectId),
    queryFn: () =>
      apiFetch<{ project: ProjectDetailShape }>(
        `/api/projects/${projectId}?orgId=${encodeURIComponent(orgId ?? "")}`
      ),
    enabled: Boolean(orgId),
  });

  const sprints = useQuery({
    queryKey: qk.sprints(orgId ?? "x", projectId),
    queryFn: () => apiFetch<{ items: SprintShape[] }>(`/api/projects/${projectId}/sprints?orgId=${orgId}`),
    enabled: Boolean(orgId),
  });

  // ---- optimistic board state (mirror of query data) ----
  // Server data is the source of truth; when a fresh snapshot arrives we
  // re-seed the local drag state during render (React's sanctioned pattern
  // for derived-state-on-prop-change) instead of copying it in an effect.
  const [columns, setColumns] = React.useState<Record<string, TaskDTO[]>>({});
  const [syncedBoard, setSyncedBoard] = React.useState<BoardDTO | null>(null);
  const prevColumns = React.useRef<Record<string, TaskDTO[]>>({});
  const prevSynced = React.useRef<BoardDTO | null>(null);

  if (board.data && board.data !== syncedBoard) {
    setSyncedBoard(board.data);
    setColumns(buildBoardColumns(board.data));
  }

  // Keep the rollback snapshot ref aligned with the latest server data.
  React.useEffect(() => {
    if (board.data && board.data !== prevSynced.current) {
      prevSynced.current = board.data;
      prevColumns.current = buildBoardColumns(board.data);
    }
  }, [board.data]);

  const qc = useQueryClient();
  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: qk.board(orgId ?? "x", projectId) });
    qc.invalidateQueries({ queryKey: qk.tasks(orgId ?? "x", projectId) });
    qc.invalidateQueries({ queryKey: qk.project(orgId ?? "x", projectId) });
  };

  const moveTask = useMutation({
    mutationFn: ({ taskId, status, position }: { taskId: string; status: string; position: number }) =>
      apiFetch(`/api/projects/${projectId}/tasks/move`, {
        method: "POST",
        body: JSON.stringify({ taskId, status, position }),
      }),
    onSuccess: invalidateAll,
    onError: (error) => {
      // Roll back to the last server snapshot.
      setColumns(structuredClone(prevColumns.current));
      toast.error(apiErrorMessage(error, "Couldn't move the task."));
      void board.refetch();
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const findColumnOf = (id: string): string | null => {
    for (const [key, tasks] of Object.entries(columns)) {
      if (tasks.some((t) => t.id === id)) return key;
    }
    return null;
  };

  const onDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id);
    const colKey = findColumnOf(id);
    const task = colKey ? columns[colKey].find((t) => t.id === id) : null;
    if (task) setActiveTask(task);
  };

  const onDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const fromCol = findColumnOf(activeId);
    const overIsCol = overId.startsWith("col:");
    const toCol = overIsCol ? overId.slice(4) : findColumnOf(overId);
    if (!fromCol || !toCol || fromCol === toCol) return;

    setColumns((prev) => {
      const next = structuredClone(prev);
      const from = next[fromCol] ?? [];
      const idx = from.findIndex((t) => t.id === activeId);
      if (idx === -1) return prev;
      const [moving] = from.splice(idx, 1);
      const to = next[toCol] ?? [];
      const overIdx = overIsCol ? to.length : to.findIndex((t) => t.id === overId);
      to.splice(overIdx === -1 ? to.length : overIdx, 0, moving);
      next[fromCol] = from;
      next[toCol] = to;
      return next;
    });
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const fromCol = findColumnOf(activeId);
    const overIsCol = overId.startsWith("col:");
    const toCol = overIsCol ? overId.slice(4) : findColumnOf(overId);
    if (!fromCol || !toCol) return;
    const list = columns[toCol] ?? [];
    const position = Math.max(0, list.findIndex((t) => t.id === activeId));

    if (fromCol === toCol) {
      // Same column: only persist when the position actually changed.
      const from = columns[fromCol] ?? [];
      const origIdx = from.findIndex((t) => t.id === activeId);
      if (origIdx === position && toCol === fromCol) {
        invalidateAll();
        return;
      }
    }

    moveTask.mutate({ taskId: activeId, status: toCol, position });
  };

  const me = useMe();
  const members: ProjectMemberShape[] = detail.data?.project.members ?? [];
  const labels = detail.data?.project.labels ?? [];
  const sprintList = sprints.data?.items ?? [];
  const canCreate = board.data?.myPermissions.canCreate ?? true;

  if (!orgId || !projectId) return null;

  if (board.isLoading && !board.data) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-6 w-40 animate-pulse rounded bg-secondary" />
          <div className="h-6 w-20 animate-pulse rounded bg-secondary" />
        </div>
        <div className="flex gap-3 overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <CardSkeleton key={i} className="h-96 w-[282px] shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  if (board.isError || !board.data) {
    return (
      <ErrorState
        title="Couldn't load the board"
        message={apiErrorMessage(board.error)}
        onRetry={() => void board.refetch()}
      />
    );
  }

  const statusKeys = board.data.statuses.map((s) => s.key);
  const anyFilter = Boolean(filters.q || filters.assigneeId || filters.priority || filters.labelId || filters.due);

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/projects/${projectId}`}
          className="inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Back
        </Link>
        <span aria-hidden className="size-2.5 rounded-sm" style={{ background: board.data.project.name ? "var(--primary)" : "var(--primary)" }} />
        <h1 className="text-base font-bold tracking-tight">{board.data.project.name}</h1>
        <span className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {board.data.project.key}
        </span>
        {board.data.truncated ? (
          <Badge variant="secondary" className="gap-1">
            <Filter className="size-3" /> Filtered view
          </Badge>
        ) : null}
        <span className="ml-auto" />
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-card px-1.5 py-1">
          <ListFilter className="size-3.5 text-muted-foreground" aria-hidden />
          <Input
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="Search…"
            aria-label="Filter tasks by title"
            className="h-7 w-32 border-0 bg-transparent px-1 text-[13px] shadow-none focus-visible:ring-0"
          />
          <Combobox
            options={members.map((m) => ({
              value: m.userId,
              label: m.name,
              leading: <AssigneeDot name={m.name} />,
            }))}
            value={filters.assigneeId}
            onValueChange={(v) => setFilter({ assigneeId: v }) }
            placeholder="Assignee"
            searchPlaceholder="Search members…"
            allowClear
            className="w-[130px]"
            triggerClassName="h-7 border-0 bg-transparent px-1 text-[13px] shadow-none"
          />
          <Select value={filters.priority ?? ""} onValueChange={(v) => setFilter({ priority: v || null })}>
            <SelectTrigger aria-label="Filter by priority" className="h-7 w-[96px] border-0 bg-transparent px-1 text-[13px] shadow-none [&>svg]:hidden">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All priorities</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="none">None</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.due ?? ""} onValueChange={(v) => setFilter({ due: v || null })}>
            <SelectTrigger aria-label="Filter by due date" className="h-7 w-[100px] border-0 bg-transparent px-1 text-[13px] shadow-none [&>svg]:hidden">
              <SelectValue placeholder="Due" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Any due date</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="today">Due today</SelectItem>
              <SelectItem value="week">Next 7 days</SelectItem>
              <SelectItem value="none">No due date</SelectItem>
            </SelectContent>
          </Select>
          {anyFilter ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Clear filters"
              onClick={() => { setFilters(EMPTY_FILTERS); setSearchDraft(""); }}
            >
              <X />
            </Button>
          ) : null}
        </div>
      </div>

      {/* Columns */}
      <div className="-mx-4 flex-1 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActiveTask(null)}
        >
          <div className="flex h-full min-h-[420px] items-stretch gap-3">
            {board.data.statuses.map((col) => (
              <BoardColumn
                key={col.key}
                column={col}
                tasks={columns[col.key] ?? []}
                canCreate={canCreate}
                onOpenTask={openTask}
                onAddTask={(status) => setCreateStatus(status)}
              />
            ))}
            {statusKeys.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                <KanbanSquare className="size-10 text-muted-foreground/40" />
                <p className="max-w-sm text-sm text-muted-foreground">
                  No columns yet. A project needs at least two statuses — configure them in project settings.
                </p>
              </div>
            ) : null}
          </div>
          <DragOverlay dropAnimation={{ duration: 180, easing: "ease" }}>
            {activeTask ? <div className="w-[266px] cursor-grabbing"><TaskCardView task={activeTask} overlay /></div> : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* New-task dialog */}
      <QuickTaskDialog
        open={Boolean(createStatus)}
        status={createStatus}
        projectId={projectId}
        orgId={orgId}
        statuses={board.data.statuses}
        members={members}
        labels={labels}
        sprints={sprintList}
        defaultSprintId={null}
        onOpenChange={(o) => !o && setCreateStatus(null)}
      />

      {/* Task detail drawer */}
      <TaskDrawer
        projectId={projectId}
        orgId={orgId}
        taskId={selectedTaskId}
        statuses={board.data.statuses}
        members={members}
        labels={labels}
        sprints={sprintList}
        meId={me.data?.user?.id ?? null}
        canUpdate={board.data?.myPermissions.canUpdate ?? false}
        onClose={closeTask}
      />
    </div>
  );
}

type ProjectDetailShape = {
  members: ProjectMemberShape[];
  labels: { id: string; name: string; color: string }[];
};
type ProjectMemberShape = ProjectMemberDTO;
type SprintShape = { id: string; name: string; status: string; startDate: string | null; endDate: string | null };

function AssigneeDot({ name }: { name: string }) {
  return (
    <span aria-hidden className="flex size-4 items-center justify-center rounded-full bg-primary/15 text-[8px] font-bold text-primary">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

