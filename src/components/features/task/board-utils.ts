import type { BoardColumnDTO } from "@/types";
import type { BoardDTO, TaskDTO } from "@/types";

export const PRIORITY_ORDER = ["urgent", "high", "medium", "low", "none"] as const;

export const PRIORITY_META: Record<
  string,
  { label: string; icon: string; cls: string; chip: string }
> = {
  urgent: {
    label: "Urgent",
    icon: "▲▲",
    cls: "text-red-600 dark:text-red-400",
    chip: "bg-red-500/12 text-red-600 dark:text-red-400",
  },
  high: {
    label: "High",
    icon: "▲",
    cls: "text-orange-600 dark:text-orange-400",
    chip: "bg-orange-500/12 text-orange-600 dark:text-orange-400",
  },
  medium: {
    label: "Medium",
    icon: "■",
    cls: "text-sky-600 dark:text-sky-400",
    chip: "bg-sky-500/12 text-sky-600 dark:text-sky-400",
  },
  low: {
    label: "Low",
    icon: "▼",
    cls: "text-muted-foreground",
    chip: "bg-muted text-muted-foreground",
  },
  none: {
    label: "No priority",
    icon: "",
    cls: "text-muted-foreground",
    chip: "text-muted-foreground",
  },
};

export function groupTasksByStatus(tasks: TaskDTO[]): Map<string, TaskDTO[]> {
  const map = new Map<string, TaskDTO[]>();
  for (const t of tasks) {
    const list = map.get(t.status);
    if (list) list.push(t);
    else map.set(t.status, [t]);
  }
  for (const list of map.values()) list.sort((a, b) => a.order - b.order);
  return map;
}

export function flattenStatuses(statuses: BoardColumnDTO[]): string[] {
  return statuses.map((s) => s.key);
}

export function boardHasOnlyOneStatus(board: BoardDTO): boolean {
  return board.statuses.length <= 1;
}
