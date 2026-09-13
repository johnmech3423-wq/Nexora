"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlarmClock,
  Bell,
  BellOff,
  Clock,
  Eye,
  Pencil,
  Plus,
  Square,
  Timer,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { useUpdateTask, useWatchTask, useDeleteTask } from "@/lib/hooks/tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { DatePicker } from "@/components/ui/date-picker";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/controls";
import { ConfirmDialog, ConfirmDialogContent } from "@/components/ui/confirm-dialog";
import { LabelPicker, type LabelOption } from "@/components/features/task/label-picker";
import { TaskComments } from "@/components/features/task/task-comments";
import { Markdown } from "@/lib/markdown";
import { PRIORITY_META } from "@/components/features/task/board-utils";
import { cn, formatDateTime, formatDuration } from "@/lib/utils";
import { toast } from "sonner";
import type { BoardColumnDTO, ProjectMemberDTO, TaskDTO } from "@/types";
import type { SprintOption } from "@/components/features/task/quick-task-dialog";

export interface MilestoneOption {
  id: string;
  name: string;
}

export function TaskDrawer({
  orgId,
  projectId,
  taskId,
  statuses,
  members,
  labels,
  sprints,
  milestones,
  meId,
  canUpdate,
  onClose,
}: {
  orgId: string;
  projectId: string;
  taskId: string | null;
  statuses: BoardColumnDTO[];
  members: ProjectMemberDTO[];
  labels: LabelOption[];
  sprints: SprintOption[];
  milestones?: MilestoneOption[];
  meId: string | null;
  canUpdate: boolean;
  onClose: () => void;
}) {
  const open = Boolean(taskId);
  const task = useQuery({
    queryKey: qk.task(orgId, projectId, taskId ?? "x"),
    queryFn: () =>
      apiFetch<{ task: TaskDTO }>(`/api/projects/${projectId}/tasks/${taskId}`),
    enabled: open,
  });
  const running = useQuery({
    queryKey: qk.runningTimer(orgId),
    queryFn: () => apiFetch<{ running: RunningTimerShape | null }>(`/api/time-entries/running?orgId=${orgId}`),
    enabled: open,
    refetchInterval: 30_000,
  });

  const update = useUpdateTask(orgId, projectId, taskId ?? undefined);
  const watch = useWatchTask(orgId, projectId, taskId ?? undefined);
  const remove = useDeleteTask(orgId, projectId, taskId ?? undefined);

  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [manualOpen, setManualOpen] = React.useState(false);

  const t = task.data?.task;
  const runningOnThis = running.data?.running && running.data.running.taskId === taskId ? running.data.running : null;

  // Reset transient states when switching tasks (derived-state pattern:
  // reset happens during render, only when the task actually changed).
  const [lastTaskId, setLastTaskId] = React.useState<string | null>(taskId);
  if (lastTaskId !== taskId) {
    setLastTaskId(taskId);
    setDeleteOpen(false);
    setManualOpen(false);
  }

  const patch = (values: Record<string, unknown>, okMsg?: string) =>
    update.mutate(values, {
      onSuccess: () => okMsg && toast.success(okMsg),
      onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't update the task."),
    });

  if (!open) return null;

  const doneKey = statuses.find((s) => s.key === "done")?.key ?? statuses[0]?.key ?? "";
  const isDone = t?.status === doneKey;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-[680px]">
        <SheetTitle className="sr-only">{t ? `Task ${t.key}: ${t.title}` : "Task"}</SheetTitle>

        {task.isLoading && !t ? (
          <div className="space-y-4 p-5">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : task.isError || !t ? (
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <p className="text-sm text-muted-foreground">
              {task.isError ? (task.error instanceof Error ? task.error.message : "Couldn't load the task.") : "Task not found."}
            </p>
            <Button variant="outline" size="sm" onClick={() => void task.refetch()}>
              Try again
            </Button>
          </div>
        ) : (
          <>
            {/* Scrolling content */}
            <div className="flex-1 space-y-5 overflow-y-auto p-5 pb-3">
              {/* status row */}
              <div className="flex items-center gap-2">
                <StatusSelect
                  status={t.status}
                  statuses={statuses}
                  onChange={(status) => patch({ status })}
                  disabled={!canUpdate}
                />
                <span className="ml-auto font-mono text-[11px] text-muted-foreground">{t.key}</span>
                <button
                  type="button"
                  aria-label="Close task"
                  onClick={onClose}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="size-4" />
                </button>
              </div>

              <EditableTitle task={t} onSave={(title) => patch({ title })} disabled={!canUpdate} />

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <span>#{t.number}</span>
                <span className="flex items-center gap-1"><Users className="size-3" /> {t.watchers.length} watching</span>
                <span className="flex items-center gap-1"><Timer className="size-3" /> {formatDuration(t.totalTrackedMs)}</span>
                <span className="flex items-center gap-1"><Clock className="size-3" /> updated {formatDateTime(t.updatedAt)}</span>
                {t.doneAt ? <span className="text-success">completed {formatDateTime(t.doneAt)}</span> : null}
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border bg-card p-4 sm:grid-cols-[110px_1fr_110px_1fr]">
                <DetailLabel>Status</DetailLabel>
                <StatusSelect status={t.status} statuses={statuses} onChange={(status) => patch({ status })} disabled={!canUpdate} slim />
                <DetailLabel>Priority</DetailLabel>
                <Select
                  value={t.priority}
                  onValueChange={(p) => patch({ priority: p })}
                  disabled={!canUpdate}
                >
                  <SelectTrigger aria-label="Priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PRIORITY_META) as string[]).map((p) => (
                      <SelectItem key={p} value={p}>
                        {PRIORITY_META[p].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <DetailLabel>Assignee</DetailLabel>
                <Combobox
                  options={members.map((m) => ({
                    value: m.userId,
                    label: m.name,
                    leading: <Avatar name={m.name} src={m.avatarUrl} size="xs" />,
                    hint: m.role,
                  }))}
                  value={t.assignee?.userId ?? null}
                  onValueChange={(v) => patch({ assigneeId: v ?? null })}
                  placeholder="Unassigned"
                  searchPlaceholder="Search members…"
                  allowClear
                  disabled={!canUpdate}
                />
                <DetailLabel>Due date</DetailLabel>
                <DatePicker
                  value={t.dueDate ? new Date(t.dueDate) : null}
                  onValueChange={(d) => patch({ dueDate: d ? d.toISOString() : null })}
                  placeholder="No due date"
                  disabled={!canUpdate}
                  className="text-[13px]"
                />
                <DetailLabel>Reporter</DetailLabel>
                <div className="flex min-h-8 items-center text-[13px]">
                  {t.reporter ? (
                    <span className="flex items-center gap-1.5">
                      <Avatar name={t.reporter.name} src={t.reporter.avatarUrl} size="xs" /> {t.reporter.name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border bg-card p-4 sm:grid-cols-[110px_1fr_110px_1fr]">
                <DetailLabel>Labels</DetailLabel>
                <div className="min-w-0">
                  <LabelPicker
                    options={labels}
                    value={t.labels.map((l) => l.id)}
                    onValueChange={(ids) =>
                      patch({
                        labels: labels.filter((l) => ids.includes(l.id)).map((l) => ({ id: l.id, name: l.name, color: l.color })),
                      })
                    }
                    disabled={!canUpdate}
                  />
                </div>
                <DetailLabel>Estimate</DetailLabel>
                <EstimateInput
                  value={t.estimateMin}
                  onSave={(min) => patch({ estimateMin: min })}
                  disabled={!canUpdate}
                />
                <DetailLabel>Sprint</DetailLabel>
                <Select
                  value={t.sprintId ?? "__none"}
                  onValueChange={(v) => patch({ sprintId: v === "__none" ? null : v })}
                  disabled={!canUpdate || sprints.length === 0}
                >
                  <SelectTrigger aria-label="Sprint">
                    <SelectValue placeholder="No sprint" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">No sprint</SelectItem>
                    {sprints.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(milestones?.length ?? 0) > 0 ? (
                  <>
                    <DetailLabel>Milestone</DetailLabel>
                    <Select
                      value={t.milestoneId ?? "__none"}
                      onValueChange={(v) => patch({ milestoneId: v === "__none" ? null : v })}
                      disabled={!canUpdate}
                    >
                      <SelectTrigger aria-label="Milestone">
                        <SelectValue placeholder="No milestone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">No milestone</SelectItem>
                        {milestones!.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                ) : null}
              </div>

              {/* Description */}
              <DescriptionBlock task={t} onSave={(description) => patch({ description })} disabled={!canUpdate} />

              {/* Subtasks */}
              <SubtasksBlock
                task={t}
                doneKey={doneKey}
                firstColumnKey={statuses[0]?.key ?? "backlog"}
                orgId={orgId}
                projectId={projectId}
                members={members}
                canUpdate={canUpdate}
                onChanged={() => void task.refetch()}
              />

              {/* Time tracking */}
              <TimeBlock
                task={t}
                orgId={orgId}
                projectId={projectId}
                runningOnThis={runningOnThis}
                runningElsewhere={running.data?.running && !runningOnThis ? running.data.running : null}
                onChanged={() => {
                  void task.refetch();
                  void running.refetch();
                }}
                canUpdate={canUpdate}
                manualOpen={manualOpen}
                setManualOpen={setManualOpen}
              />

              {/* Watchers */}
              <WatchersBlock
                task={t}
                members={members}
                isWatching={t.isWatching}
                canUpdate={canUpdate}
                onToggle={() => watch.mutate(!t.isWatching, { onError: (e) => toast.error(msg(e)) })}
                onAdd={(userId) => {
                  const set = new Set(t.watchers.map((w) => w.userId));
                  set.add(userId);
                  void patch({ watchers: [...set] });
                }}
                onRemove={(userId) => {
                  const set = new Set(t.watchers.map((w) => w.userId));
                  set.delete(userId);
                  void patch({ watchers: [...set] });
                }}
              />

              {/* Comments */}
              <TaskComments
                orgId={orgId}
                projectId={projectId}
                taskId={t.id}
                members={members}
                meId={meId}
                canComment={canUpdate}
              />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t px-5 py-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Avatar name={t.createdBy?.name ?? t.reporter?.name ?? "?"} src={t.createdBy?.avatarUrl ?? null} size="xs" />
                <span>
                  Created by {t.createdBy?.name ?? t.reporter?.name ?? "unknown"} ·{" "}
                  {new Date(t.createdAt).toLocaleDateString()}
                </span>
              </div>
              {canUpdate ? (
                <ConfirmButtonRow loading={remove.isPending} onDelete={() => setDeleteOpen(true)} />
              ) : null}
            </div>
          </>
        )}

        <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <ConfirmDialogContent
            title="Delete this task?"
            description={t ? `${t.key} “${t.title}” will be permanently deleted, along with its comments and time entries.` : ""}
            confirmLabel="Delete task"
            destructive
            loading={remove.isPending}
            onConfirm={() =>
              remove.mutate(undefined, {
                onSuccess: () => {
                  toast.success("Task deleted");
                  onClose();
                },
                onError: (e) => toast.error(msg(e)),
              })
            }
          />
        </ConfirmDialog>
      </SheetContent>
    </Sheet>
  );
}

/* ---------------- small building blocks ---------------- */

type RunningTimerShape = {
  id: string;
  taskId: string;
  taskKey: string;
  taskTitle: string;
  startAt: string;
};

function msg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong.";
}

function DetailLabel({ children }: { children: React.ReactNode }) {
  return <span className="flex items-center text-[11px] font-medium text-muted-foreground">{children}</span>;
}

function StatusSelect({
  status,
  statuses,
  onChange,
  disabled,
  slim,
}: {
  status: string;
  statuses: BoardColumnDTO[];
  onChange: (status: string) => void;
  disabled?: boolean;
  slim?: boolean;
}) {
  const current = statuses.find((s) => s.key === status);
  return (
    <Select value={status} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        aria-label="Status"
        className={cn("gap-2 border-transparent font-medium shadow-none hover:bg-accent", slim && "h-8")}
      >
        <span className="flex items-center gap-2">
          <span aria-hidden className="size-2 rounded-full" style={{ background: current?.color ?? "#64748b" }} />
          {current?.label ?? status}
        </span>
      </SelectTrigger>
      <SelectContent>
        {statuses.map((s) => (
          <SelectItem key={s.key} value={s.key}>
            <span className="flex items-center gap-2">
              <span aria-hidden className="size-2 rounded-full" style={{ background: s.color }} />
              {s.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Title auto-saves on blur (and on Ctrl+Enter). */
function EditableTitle({ task, onSave, disabled }: { task: TaskDTO; onSave: (title: string) => void; disabled?: boolean }) {
  const [value, setValue] = React.useState(task.title);
  const [editing, setEditing] = React.useState(false);
  const [lastTitle, setLastTitle] = React.useState<{ id: string; title: string } | null>(null);
  if (!lastTitle || lastTitle.id !== task.id || lastTitle.title !== task.title) {
    setLastTitle({ id: task.id, title: task.title });
    setValue(task.title);
    setEditing(false);
  }

  if (!editing) {
    return (
      <h2
        role="button"
        tabIndex={0}
        aria-label="Edit title"
        onClick={() => !disabled && setEditing(true)}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !disabled) {
            e.preventDefault();
            setEditing(true);
          }
        }}
        className="group flex items-start gap-2 text-lg leading-snug font-bold tracking-tight break-words outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md cursor-text"
      >
        <span>{value}</span>
        {!disabled ? <Pencil className="mt-1 size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" /> : null}
      </h2>
    );
  }
  return (
    <Textarea
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      rows={Math.min(5, Math.max(1, value.split("\n").length))}
      className="text-lg font-bold"
      onBlur={() => {
        const v = value.trim();
        if (v && v !== task.title) onSave(v);
        else setValue(task.title);
        setEditing(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          (e.target as HTMLTextAreaElement).blur();
        }
        if (e.key === "Escape") {
          setValue(task.title);
          setEditing(false);
        }
      }}
    />
  );
}

function EstimateInput({ value, onSave, disabled }: { value: number | null; onSave: (min: number | null) => void; disabled?: boolean }) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value ? String(value) : "");
  const commit = () => {
    const n = draft.trim() === "" ? null : Number(draft);
    if (n !== null && (Number.isNaN(n) || n < 0 || n > 525600)) {
      toast.error("Estimate must be between 0 and 525600 minutes.");
      return;
    }
    if (n !== value) onSave(n);
    setEditing(false);
  };
  if (!editing) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setEditing(true)}
        className="min-h-8 rounded-md px-1 text-left text-[13px] outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed"
      >
        {value ? `${value} min` : <span className="text-muted-foreground">No estimate</span>}
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <Input
        autoFocus
        type="number"
        min={0}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(value ? String(value) : "");
            setEditing(false);
          }
        }}
        aria-label="Estimate in minutes"
        className="h-8 w-24 text-[13px]"
      />
      <span className="text-xs text-muted-foreground">min</span>
    </div>
  );
}

function DescriptionBlock({ task, onSave, disabled }: { task: TaskDTO; onSave: (description: string) => void; disabled?: boolean }) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(task.description);
  const [mode, setMode] = React.useState<"write" | "preview">("write");

  const [lastDesc, setLastDesc] = React.useState<{ id: string; description: string } | null>(null);
  if (!lastDesc || lastDesc.id !== task.id || lastDesc.description !== task.description) {
    setLastDesc({ id: task.id, description: task.description });
    setDraft(task.description);
    setEditing(false);
    setMode("write");
  }

  if (!editing) {
    return (
      <section aria-label="Description">
        <div className="mb-1.5 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <Pencil className="size-3.5 text-muted-foreground" aria-hidden /> Description
          </h3>
          {!disabled ? (
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setEditing(true)}>
              {task.description ? "Edit" : "Add description"}
            </Button>
          ) : null}
        </div>
        {task.description ? (
          <div className="rounded-lg border bg-card p-3">
            <Markdown className="text-[13px] leading-relaxed">{task.description}</Markdown>
          </div>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setEditing(true)}
            className="w-full rounded-lg border border-dashed px-3 py-4 text-left text-[13px] text-muted-foreground outline-none hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed"
          >
            Describe the task — markdown supported (# heading, **bold**, `code`, lists…)
          </button>
        )}
      </section>
    );
  }

  return (
    <section aria-label="Edit description">
      <div className="mb-1.5 flex items-center gap-2">
        <h3 className="text-sm font-semibold">Description</h3>
        <div className="flex rounded-md border p-0.5">
          {(["write", "preview"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn("rounded px-2 py-0.5 text-[11px] font-medium capitalize", mode === m ? "bg-secondary" : "text-muted-foreground")}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      {mode === "write" ? (
        <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={8} className="font-mono text-[12.5px]" autoFocus />
      ) : (
        <div className="min-h-24 rounded-md border bg-card p-3">
          {draft.trim() ? <Markdown className="text-[13px]">{draft}</Markdown> : <p className="text-sm text-muted-foreground">Nothing yet.</p>}
        </div>
      )}
      <div className="mt-1.5 flex gap-1.5">
        <Button
          size="sm"
          onClick={() => {
            onSave(draft.trim());
            setEditing(false);
          }}
        >
          Save
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setDraft(task.description);
            setEditing(false);
          }}
        >
          Cancel
        </Button>
      </div>
    </section>
  );
}

function SubtasksBlock({
  task,
  doneKey,
  firstColumnKey,
  orgId,
  projectId,
  members,
  canUpdate,
  onChanged,
}: {
  task: TaskDTO;
  doneKey: string;
  firstColumnKey: string;
  orgId: string;
  projectId: string;
  members: ProjectMemberDTO[];
  canUpdate: boolean;
  onChanged: () => void;
}) {
  const update = useUpdateTask(orgId, projectId, task.id);
  const [adding, setAdding] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);

  const patch = (values: Record<string, unknown>) =>
    update.mutate(values, { onError: (e) => toast.error(msg(e)) });

  const createSub = () => {
    const title = draft.trim();
    if (!title) return;
    void apiFetch(`/api/projects/${projectId}/tasks`, {
      method: "POST",
      body: JSON.stringify({ title, parentId: task.id, status: firstColumnKey }),
    })
      .then(() => {
        setDraft("");
        setAdding(false);
        onChanged();
      })
      .catch((e) => toast.error(msg(e)));
  };

  const subtasks = task.subtasks.filter((s) => !s.hasChildren);
  const done = task.completedSubtaskCount;
  const pct = task.subtaskCount ? Math.round((done / task.subtaskCount) * 100) : 0;

  return (
    <section aria-label="Subtasks">
      <div className="mb-1.5 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <CheckBoxIcon /> Subtasks
          <span className="text-xs font-normal text-muted-foreground tabular-nums">
            {done}/{task.subtaskCount}
          </span>
        </h3>
        {canUpdate ? (
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => setAdding((v) => !v)}>
            <Plus /> Add
          </Button>
        ) : null}
      </div>
      {task.subtaskCount > 0 ? <Progress value={pct} className="mb-2 h-1" /> : null}
      <ul className="space-y-1">
        {subtasks.map((s) => {
          const isDone = s.status === doneKey;
          return (
            <li key={s.id} className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-accent/50">
              {editingId === s.id ? (
                <EditableRow
                  initial={s.title}
                  onCancel={() => setEditingId(null)}
                  onSave={(title) => {
                    patch({ title });
                    setEditingId(null);
                  }}
                />
              ) : (
                <>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isDone}
                    aria-label={`Mark "${s.title}" ${isDone ? "not done" : "done"}`}
                    disabled={!canUpdate}
                    onClick={() => patch({ status: isDone ? firstColumnKey : doneKey })}
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded border transition-colors disabled:cursor-not-allowed",
                      isDone ? "border-primary bg-primary" : "border-muted-foreground/40 hover:border-primary"
                    )}
                  >
                    {isDone ? <CheckGlyph /> : null}
                  </button>
                  <button
                    type="button"
                    onClick={() => canUpdate && setEditingId(s.id)}
                    className={cn(
                      "min-w-0 flex-1 truncate text-left text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring rounded",
                      isDone && "text-muted-foreground line-through"
                    )}
                  >
                    {s.title}
                  </button>
                  {s.assigneeId ? (
                    <AssigneeChip userId={s.assigneeId} members={members} />
                  ) : (
                    <AssignQuick members={members} onPick={(userId) => patch({ assigneeId: userId })} />
                  )}
                  {canUpdate ? (
                    <button
                      type="button"
                      aria-label="Delete subtask"
                      onClick={() => void apiFetch(`/api/projects/${projectId}/tasks/${s.id}`, { method: "DELETE" }).then(onChanged).catch((e) => toast.error(msg(e)))}
                      className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  ) : null}
                </>
              )}
            </li>
          );
        })}
      </ul>
      {adding ? (
        <div className="mt-1.5 flex items-center gap-2">
          <span aria-hidden className="size-4 shrink-0 rounded border border-dashed border-muted-foreground/40" />
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Subtask title"
            className="h-8 flex-1 text-[13px]"
            onKeyDown={(e) => {
              if (e.key === "Enter") createSub();
              if (e.key === "Escape") {
                setAdding(false);
                setDraft("");
              }
            }}
          />
          <Button size="sm" onClick={createSub} disabled={!draft.trim()}>
            Add
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setDraft(""); }}>
            Cancel
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function EditableRow({ initial, onCancel, onSave }: { initial: string; onCancel: () => void; onSave: (v: string) => void }) {
  const [v, setV] = React.useState(initial);
  return (
    <div className="flex flex-1 items-center gap-1.5">
      <Input
        autoFocus
        value={v}
        onChange={(e) => setV(e.target.value)}
        className="h-8 flex-1 text-[13px]"
        onKeyDown={(e) => {
          if (e.key === "Enter" && v.trim()) onSave(v.trim());
          if (e.key === "Escape") onCancel();
        }}
      />
      <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
    </div>
  );
}

function CheckGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="size-3 text-primary-foreground">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
function CheckBoxIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5 text-muted-foreground" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function AssigneeChip({ userId, members }: { userId: string; members: ProjectMemberDTO[] }) {
  const m = members.find((x) => x.userId === userId);
  if (!m) return null;
  return (
    <span className="flex items-center gap-1 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
      <Avatar name={m.name} src={m.avatarUrl} size="xs" /> {m.name.split(" ")[0]}
    </span>
  );
}

function AssignQuick({ members, onPick }: { members: ProjectMemberDTO[]; onPick: (userId: string) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Assign subtask"
          className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
        >
          <Plus className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1">
        {members.map((m) => (
          <button
            key={m.userId}
            type="button"
            onClick={() => onPick(m.userId)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-accent"
          >
            <Avatar name={m.name} src={m.avatarUrl} size="xs" />
            <span className="truncate">{m.name}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function TimeBlock({
  task,
  orgId,
  projectId,
  runningOnThis,
  runningElsewhere,
  onChanged,
  canUpdate,
  manualOpen,
  setManualOpen,
}: {
  task: TaskDTO;
  orgId: string;
  projectId: string;
  runningOnThis: RunningTimerShape | null;
  runningElsewhere: RunningTimerShape | null;
  onChanged: () => void;
  canUpdate: boolean;
  manualOpen: boolean;
  setManualOpen: (open: boolean) => void;
}) {
  const [elapsed, setElapsed] = React.useState(0);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!runningOnThis) return;
    const tick = () => setElapsed(Date.now() - new Date(runningOnThis.startAt).getTime());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [runningOnThis?.id, runningOnThis?.startAt]);

  const doStart = async () => {
    setBusy(true);
    try {
      if (runningElsewhere) {
        await apiFetch("/api/time-entries/stop", { method: "POST" });
      }
      await apiFetch(`/api/projects/${projectId}/tasks/${task.id}/time-entries/start`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      toast.success("Timer started");
      onChanged();
    } catch (e) {
      toast.error(msg(e));
    } finally {
      setBusy(false);
    }
  };
  const doStop = async () => {
    setBusy(true);
    try {
      await apiFetch("/api/time-entries/stop", { method: "POST" });
      toast.success("Timer stopped and logged");
      onChanged();
    } catch (e) {
      toast.error(msg(e));
    } finally {
      setBusy(false);
    }
  };

  const runningMs = runningOnThis ? elapsed : 0;

  return (
    <section aria-label="Time tracking" className="rounded-lg border bg-card p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <AlarmClock className="size-3.5 text-muted-foreground" aria-hidden /> Time
        </h3>
        <span className="text-sm font-medium tabular-nums">{formatDuration(task.totalTrackedMs + runningMs)}</span>
        <span className="text-[11px] text-muted-foreground">logged on this task</span>
        <div className="ml-auto flex items-center gap-1.5">
          {runningElsewhere ? (
            <Badge variant="secondary" className="gap-1 text-[11px]">
              <Timer className="size-3 animate-pulse" /> running on {runningElsewhere.taskKey}
            </Badge>
          ) : null}
          {canUpdate ? (
            <>
              {runningOnThis ? (
                <Button size="sm" variant="outline" loading={busy} onClick={doStop} className="border-red-500/40 text-red-600 hover:bg-red-500/10 dark:text-red-400">
                  <Square className="size-3 fill-current" /> Stop
                </Button>
              ) : (
                <Button size="sm" loading={busy} onClick={doStart}>
                  <PlayGlyph /> Start timer
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setManualOpen(true)}>
                <Plus /> Manual
              </Button>
            </>
          ) : null}
        </div>
      </div>
      {runningOnThis ? (
        <p className="mt-2 rounded-md bg-success/10 px-2.5 py-1.5 font-mono text-[13px] font-semibold text-success tabular-nums">
          {formatDuration(runningMs)} tracking now
        </p>
      ) : null}
      <ManualEntryDialog
        open={manualOpen}
        onOpenChange={setManualOpen}
        taskId={task.id}
        projectId={projectId}
        orgId={orgId}
        onDone={onChanged}
      />
    </section>
  );
}

function PlayGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-3">
      <path d="M8 5.14v13.72c0 .8.87 1.3 1.56.88l11-6.86a1.05 1.05 0 0 0 0-1.76l-11-6.86A1.04 1.04 0 0 0 8 5.14Z" />
    </svg>
  );
}

function ManualEntryDialog({
  open,
  onOpenChange,
  taskId,
  projectId,
  orgId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  projectId: string;
  orgId: string;
  onDone: () => void;
}) {
  const [date, setDate] = React.useState<Date | null>(new Date());
  const [time, setTime] = React.useState("09:00");
  const [duration, setDuration] = React.useState("30");
  const [description, setDescription] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const save = async () => {
    const mins = Number(duration);
    if (!date || !time || !Number.isFinite(mins) || mins <= 0 || mins > 1440) {
      toast.error("Enter a valid date, time and duration (1–1440 minutes).");
      return;
    }
    const [hh, mm] = time.split(":").map(Number);
    const startAt = new Date(date);
    startAt.setHours(hh, mm, 0, 0);
    const endAt = new Date(startAt.getTime() + mins * 60_000);
    if (endAt > new Date()) endAt.setTime(Math.min(endAt.getTime(), Date.now()));
    setSaving(true);
    try {
      await apiFetch(`/api/projects/${projectId}/tasks/${taskId}/time-entries`, {
        method: "POST",
        body: JSON.stringify({
          description: description.trim() || undefined,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
        }),
      });
      toast.success("Time entry added");
      setDescription("");
      onOpenChange(false);
      onDone();
    } catch (e) {
      toast.error(msg(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverContent align="end" className="w-80">
        <div className="space-y-3">
          <p className="text-sm font-semibold">Add time manually</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground">Date</span>
              <DatePicker value={date} onValueChange={setDate} placeholder="Pick date" />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground">Start time</span>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </label>
          </div>
          <label className="block space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground">Duration (minutes)</span>
            <Input
              type="number"
              min={1}
              max={1440}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground">Description</span>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What did you work on?"
              maxLength={500}
            />
          </label>
          <Button size="sm" className="w-full" onClick={save} loading={saving}>
            Add entry
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function WatchersBlock({
  task,
  members,
  isWatching,
  canUpdate,
  onToggle,
  onAdd,
  onRemove,
}: {
  task: TaskDTO;
  members: ProjectMemberDTO[];
  isWatching: boolean;
  canUpdate: boolean;
  onToggle: () => void;
  onAdd: (userId: string) => void;
  onRemove: (userId: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const watcherIds = new Set(task.watchers.map((w) => w.userId));
  return (
    <section aria-label="Watchers" className="rounded-lg border bg-card p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <Eye className="size-3.5 text-muted-foreground" aria-hidden /> Watchers
          <span className="text-xs font-normal text-muted-foreground tabular-nums">{task.watchers.length}</span>
        </h3>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex -space-x-1.5">
            {task.watchers.slice(0, 5).map((w) => (
              <Avatar key={w.userId} name={w.name} src={w.avatarUrl} size="xs" className="ring-2 ring-card" title={w.name} />
            ))}
            {task.watchers.length > 5 ? (
              <span className="flex size-5 items-center justify-center rounded-full bg-secondary text-[9px] font-semibold ring-2 ring-card">
                +{task.watchers.length - 5}
              </span>
            ) : null}
          </div>
          {canUpdate ? (
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Bell className="size-3.5" /> {isWatching ? "Watching" : "Watch"}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-1">
                <p className="px-2 pt-1 pb-1.5 text-xs font-medium text-muted-foreground">
                  People who get notified about this task
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onToggle();
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-accent"
                >
                  {isWatching ? <BellOff className="size-4 text-muted-foreground" /> : <Bell className="size-4 text-muted-foreground" />}
                  {isWatching ? "Stop watching" : "Watch this task"}
                </button>
                <div className="my-1 border-t" />
                <div className="max-h-44 space-y-0.5 overflow-y-auto">
                  {members.filter((m) => !watcherIds.has(m.userId)).map((m) => (
                    <button
                      key={m.userId}
                      type="button"
                      onClick={() => {
                        onAdd(m.userId);
                        setOpen(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-accent"
                    >
                      <Avatar name={m.name} src={m.avatarUrl} size="xs" />
                      <span className="truncate">{m.name}</span>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          ) : (
            <Badge variant="secondary">{isWatching ? "Watching" : "Not watching"}</Badge>
          )}
        </div>
      </div>
      {task.watchers.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">No watchers — you&apos;re only notified if you&apos;re the assignee or reporter.</p>
      ) : null}
    </section>
  );
}

function ConfirmButtonRow({ loading, onDelete }: { loading: boolean; onDelete: () => void }) {
  return (
    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={onDelete} loading={loading}>
      <Trash2 /> Delete task
    </Button>
  );
}
