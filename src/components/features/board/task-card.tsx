"use client";

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlignLeft, CalendarClock, MessageSquare, Paperclip, SquareCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNow } from "@/lib/hooks/use-now";
import { PRIORITY_META } from "@/components/features/task/board-utils";
import type { TaskDTO } from "@/types";

export interface CardData {
  task: TaskDTO;
  onOpen: (id: string) => void;
  showProject?: boolean;
}

/** Render a task card (used by both the list item and the drag overlay). */
export function TaskCardView({ task, onOpen, overlay }: { task: TaskDTO; onOpen?: () => void; overlay?: boolean }) {
  const now = useNow();
  const prio = PRIORITY_META[task.priority] ?? PRIORITY_META.none;
  const overdue = !!task.dueDate && new Date(task.dueDate).getTime() < now && task.status !== "done";
  return (
    <div
      role={overlay ? undefined : "button"}
      tabIndex={overlay ? undefined : 0}
      aria-label={`Open task ${task.key}: ${task.title}`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (!overlay && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onOpen?.();
        }
      }}
      className={cn(
        "group/card w-full cursor-grab rounded-lg border bg-card p-2.5 text-left shadow-xs transition-colors",
        !overlay && "hover:border-primary/50 hover:shadow-sm active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-[10px] font-medium text-muted-foreground">{task.key}</span>
        {task.priority !== "none" ? (
          <span aria-label={`Priority ${prio.label}`} className={cn("text-[10px] font-bold leading-none", prio.cls)}>
            {prio.icon}
          </span>
        ) : null}
      </div>
      <p className="mt-1 line-clamp-2 text-[13px] leading-snug font-medium">{task.title}</p>
      {task.labels.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.labels.slice(0, 3).map((l) => (
            <span
              key={l.id}
              className="max-w-[130px] truncate rounded-sm px-1.5 py-px text-[10px] font-medium"
              style={{ background: `${l.color}26`, color: l.color }}
            >
              {l.name}
            </span>
          ))}
          {task.labels.length > 3 ? <span className="text-[10px] text-muted-foreground">+{task.labels.length - 3}</span> : null}
        </div>
      ) : null}
      <div className="mt-2.5 flex items-center gap-3 text-[11px] text-muted-foreground">
        {task.subtaskCount > 0 ? (
          <span className="flex items-center gap-1" aria-label={`${task.completedSubtaskCount} of ${task.subtaskCount} subtasks done`}>
            <SquareCheck className={cn("size-3.5", task.completedSubtaskCount === task.subtaskCount && "text-success")} />
            <span className={cn("tabular-nums", task.completedSubtaskCount === task.subtaskCount && "text-success")}>
              {task.completedSubtaskCount}/{task.subtaskCount}
            </span>
          </span>
        ) : null}
        {task.commentCount > 0 ? (
          <span className="flex items-center gap-1" aria-label={`${task.commentCount} comments`}>
            <MessageSquare className="size-3.5" /> {task.commentCount}
          </span>
        ) : null}
        {task.attachmentCount > 0 ? (
          <span className="flex items-center gap-1" aria-label={`${task.attachmentCount} attachments`}>
            <Paperclip className="size-3.5" /> {task.attachmentCount}
          </span>
        ) : null}
        {task.description ? (
          <AlignLeft className="size-3.5 opacity-70" aria-label="Has description" />
        ) : null}
        <span className="ml-auto flex items-center gap-1.5">
          {task.dueDate ? (
            <span className={cn("flex items-center gap-1", overdue ? "font-semibold text-destructive" : "")}>
              <CalendarClock className="size-3.5" />
              {new Date(task.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
          ) : null}
          {task.assignee ? (
            <span
              aria-hidden
              className="flex size-5 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-[9px] font-bold text-primary"
              title={task.assignee.name}
            >
              {task.assignee.name.charAt(0).toUpperCase()}
            </span>
          ) : null}
        </span>
      </div>
    </div>
  );
}

/** Sortable wrapper around TaskCardView. */
export function SortableTaskCard({ task, onOpen, showProject }: CardData & { showProject?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", task },
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("relative", isDragging && "z-10 opacity-40")}
      {...attributes}
      {...listeners}
    >
      <TaskCardView task={task} onOpen={showProject ? undefined : () => onOpen(task.id)} />
    </div>
  );
}
