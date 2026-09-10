"use client";

import * as React from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { SortableTaskCard } from "@/components/features/board/task-card";
import type { BoardColumnDTO, TaskDTO } from "@/types";

export function BoardColumn({
  column,
  tasks,
  canCreate,
  onOpenTask,
  onAddTask,
}: {
  column: BoardColumnDTO;
  tasks: TaskDTO[];
  canCreate: boolean;
  onOpenTask: (taskId: string) => void;
  onAddTask: (status: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${column.key}`, data: { type: "column", key: column.key } });

  return (
    <section
      ref={setNodeRef}
      aria-label={`${column.label} column`}
      className={cn(
        "flex w-[282px] shrink-0 flex-col rounded-xl border bg-muted/30 transition-colors",
        isOver && "border-primary/60 bg-primary/[0.04]"
      )}
    >
      <header className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
        <span aria-hidden className="size-2 rounded-full" style={{ background: column.color }} />
        <h3 className="text-[12.5px] font-semibold tracking-wide">{column.label}</h3>
        <span className="rounded-full bg-secondary px-1.5 text-[10px] font-semibold text-muted-foreground tabular-nums">
          {tasks.length}
        </span>
        {canCreate ? (
          <button
            type="button"
            onClick={() => onAddTask(column.key)}
            aria-label={`Create task in ${column.label}`}
            className="ml-auto rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="size-3.5" />
          </button>
        ) : null}
      </header>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
          {tasks.length === 0 ? (
            <div className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
              Drop tasks here
            </div>
          ) : null}
          {tasks.map((t) => (
            <SortableTaskCard key={t.id} task={t} onOpen={onOpenTask} />
          ))}
        </div>
      </SortableContext>
    </section>
  );
}
