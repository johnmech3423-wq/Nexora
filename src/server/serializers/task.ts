import type { TaskDTO, SubtaskDTO, AssigneeDTO, CommentDTO, BoardColumnDTO, ReactionDTO } from "@/types";
import { DONE_STATUS_KEY } from "@/lib/constants";

export interface RichTask {
  _id: unknown;
  projectId: unknown;
  number: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  assigneeId: unknown;
  reporterId: unknown;
  dueDate: Date | null;
  startDate: Date | null;
  estimateMin: number | null;
  labels: { id: string; name: string; color: string }[];
  order: number;
  parentId: unknown;
  sprintId: unknown;
  milestoneId: unknown;
  watchers: unknown[];
  statusUpdatedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: unknown;
}

export interface TaskCounts {
  commentCount?: number;
  attachmentCount?: number;
  subtaskCount?: number;
  completedSubtaskCount?: number;
}

export function emptyPerson(userId: unknown): AssigneeDTO {
  return { userId: String(userId), name: "Unknown", email: "", avatarUrl: null };
}

type UserInfo = { id: string; name: string; email: string; avatarUrl: string | null };
export function toAssignee(info: UserInfo | undefined): AssigneeDTO | null {
  if (!info) return null;
  return { userId: info.id, name: info.name, email: info.email, avatarUrl: info.avatarUrl };
}

export function serializeTask(
  task: RichTask,
  users: Map<string, { id: string; name: string; email: string; avatarUrl: string | null }>,
  actorUserId: string,
  projectKey: string,
  counts: TaskCounts = {},
  subtasks: SubtaskDTO[] = [],
  totalTrackedMs = 0,
  isWatching?: boolean
): TaskDTO {
  const assignee = toAssignee(users.get(String(task.assigneeId))) ?? (task.assigneeId ? emptyPerson(task.assigneeId) : null);
  const reporter = toAssignee(users.get(String(task.reporterId))) ?? emptyPerson(task.reporterId);
  const creator = toAssignee(users.get(String(task.createdBy))) ?? (task.createdBy ? emptyPerson(task.createdBy) : null);

  return {
    id: String(task._id),
    projectId: String(task.projectId),
    projectKey,
    number: task.number,
    key: `${projectKey}-${task.number}`,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    assignee,
    reporter,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    startDate: task.startDate ? task.startDate.toISOString() : null,
    estimateMin: task.estimateMin,
    labels: task.labels,
    order: task.order,
    parentId: task.parentId ? String(task.parentId) : null,
    sprintId: task.sprintId ? String(task.sprintId) : null,
    milestoneId: task.milestoneId ? String(task.milestoneId) : null,
    watchers: (task.watchers ?? []).map((w) => {
      const info = users.get(String(w));
      return info ? { userId: info.id, name: info.name, avatarUrl: info.avatarUrl } : { userId: String(w), name: "Unknown", avatarUrl: null };
    }),
    isWatching: isWatching ?? (task.watchers ?? []).some((w) => String(w) === actorUserId),
    commentCount: counts.commentCount ?? 0,
    attachmentCount: counts.attachmentCount ?? 0,
    subtasks,
    completedSubtaskCount: counts.completedSubtaskCount ?? 0,
    subtaskCount: counts.subtaskCount ?? 0,
    totalTrackedMs,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    doneAt: task.completedAt ? task.completedAt.toISOString() : null,
    createdBy: creator,
  };
}

export function serializeSubtask(t: {
  _id: unknown;
  title: string;
  status: string;
  assigneeId: unknown;
  dueDate: Date | null;
  priority: string;
  order: number;
}): SubtaskDTO {
  return {
    id: String(t._id),
    title: t.title,
    status: t.status,
    assigneeId: t.assigneeId ? String(t.assigneeId) : null,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    priority: t.priority,
    hasChildren: false,
    order: t.order,
  };
}

export function serializeBoardColumn(key: string, label: string, color: string, taskCount: number): BoardColumnDTO {
  return { key, label, color, taskCount };
}

export function serializeComment(
  c: {
    _id: unknown;
    taskId: unknown;
    parentId: unknown;
    authorId: unknown;
    body: string;
    mentions: unknown[];
    reactions: { emoji: string; userIds: unknown[] }[];
    editedAt: Date | null;
    createdAt: Date;
  },
  users: Map<string, { id: string; name: string; email: string; avatarUrl: string | null }>,
  actorUserId: string,
  replyCount: number,
  canModerate: boolean
): CommentDTO {
  const author = toAssignee(users.get(String(c.authorId))) ?? emptyPerson(c.authorId);
  return {
    id: String(c._id),
    taskId: String(c.taskId),
    parentId: c.parentId ? String(c.parentId) : null,
    author,
    body: c.body,
    mentions: c.mentions.map(String),
    reactions: serializeReactions(c.reactions ?? [], actorUserId),
    editedAt: c.editedAt ? c.editedAt.toISOString() : null,
    createdAt: c.createdAt.toISOString(),
    replyCount,
    canEdit: String(c.authorId) === actorUserId,
    canDelete: String(c.authorId) === actorUserId || canModerate,
  };
}

export function serializeReactions(
  reactions: { emoji: string; userIds: unknown[] }[],
  actorUserId: string
): ReactionDTO[] {
  return reactions
    .filter((r) => r.userIds.length > 0)
    .map((r) => ({
      emoji: r.emoji,
      count: r.userIds.length,
      reactedByMe: r.userIds.some((u) => String(u) === actorUserId),
    }));
}

export function statusIsDone(status: string): boolean {
  return status === DONE_STATUS_KEY;
}
