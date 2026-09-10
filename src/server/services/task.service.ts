import { connectDb } from "@/server/db/db";
import { Project } from "@/server/db/models/project.model";
import { ProjectMember } from "@/server/db/models/project-member.model";
import { Membership } from "@/server/db/models/membership.model";
import { Task, type TaskDoc } from "@/server/db/models/task.model";
import { TaskComment } from "@/server/db/models/task-comment.model";
import { File } from "@/server/db/models/file.model";
import { Sprint } from "@/server/db/models/sprint.model";
import { Milestone } from "@/server/db/models/milestone.model";
import { TimeEntry } from "@/server/db/models/time-entry.model";
import { nextTaskNumber } from "@/server/db/models/task-counter.model";
import { ApiError } from "@/server/errors";
import { assertProjectPermission } from "@/server/authorization/guard";
import { orgRoleHasPermission } from "@/lib/permissions";
import type { OrgPermissionKey } from "@/lib/permissions";
import { DONE_STATUS_KEY, PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from "@/lib/constants";
import { logActivity } from "@/server/services/activity.service";
import { dispatchWebhookEvent } from "@/server/services/webhook.service";

import { getUserInfos } from "@/server/db/lookups";
import { publish, orgChannel } from "@/server/realtime/events";
import { serializeTask, type RichTask, type TaskCounts } from "@/server/serializers/task";
import type { TaskDTO, BoardDTO } from "@/types";

const MAX_SUBTASK_DEPTH = 2; // root (0) + subtask (1) + sub-subtask (2)
const BOARD_TASK_CAP = 600;
const ORDER_STEP = 1024;

export interface TaskListOptions {
  page: number;
  pageSize: number;
  q?: string;
  status?: string;
  statuses?: string[];
  priority?: string;
  assigneeId?: string;
  reporterId?: string;
  labelId?: string;
  sprintId?: string;
  milestoneId?: string;
  parentId?: string | null;
  due?: "overdue" | "today" | "week" | "none";
  sort?: "updated" | "created" | "dueDate" | "priority" | "number";
  includeDone?: boolean;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

async function loadProject(projectId: string) {
  const project = await Project.findById(projectId).where("deletedAt").equals(null);
  if (!project) throw ApiError.notFound();
  return project;
}

async function assertTaskPermission(
  actorUserId: string,
  projectId: string,
  permission: OrgPermissionKey,
  orgRole?: string
): Promise<void> {
  // project-scope check
  await assertProjectPermission(actorUserId, projectId, permission as never);
  void orgRole;
}

/** Find a task verifying it belongs to the project (404 on mismatch). */
async function findTaskInProject(projectId: string, taskId: string): Promise<InstanceType<typeof Task>> {
  const task = await Task.findOne({ _id: taskId, projectId, deletedAt: null });
  if (!task) throw ApiError.notFound("That task no longer exists.");
  return task;
}

/** Column order spacing: [prev.order, next.order] window. */
function computeOrder(prev: number | null, next: number | null): number {
  if (prev === null && next === null) return ORDER_STEP;
  if (prev === null) return next! - ORDER_STEP;
  if (next === null) return prev + ORDER_STEP;
  return (prev + next) / 2;
}

async function normalizeColumnOrder(projectId: string, status: string): Promise<void> {
  const tasks = await Task.find({ projectId, status, deletedAt: null }).sort({ order: 1 }).select("_id").lean();
  const ops = tasks.map((t, i) => ({
    updateOne: { filter: { _id: t._id }, update: { $set: { order: (i + 1) * ORDER_STEP } } },
  }));
  if (ops.length) await Task.bulkWrite(ops);
}

export async function setTaskOrder(actorUserId: string, projectId: string, taskId: string, order: number): Promise<void> {
  await connectDb();
  await assertProjectPermission(actorUserId, projectId, "task.update");
  const task = await findTaskInProject(projectId, taskId);
  if (order < 0 || order > 1e12) throw ApiError.badRequest("Invalid order value.");
  const gap = Math.abs(order - task.order);
  task.order = gap < 1e-9 ? order : order; // explicit replace (client-driven fractional orders)
  task.order = order;
  await task.save();
  void publish([orgChannel(String(task.organizationId))], "task.moved", { id: taskId, projectId, order });
}

/** Move a task to (status, position). position 0-based within column. */
export async function moveTask(
  actorUserId: string,
  projectId: string,
  taskId: string,
  status: string,
  position: number
): Promise<void> {
  await connectDb();
  await assertProjectPermission(actorUserId, projectId, "task.update");
  const [project, task] = await Promise.all([loadProject(projectId), findTaskInProject(projectId, taskId)]);
  const column = project.statuses.find((s) => s.key === status);
  if (!column) throw ApiError.badRequest(`Project has no "${status}" column.`);

  const fromStatus = task.status;
  const columnTasks = await Task.find({ projectId, status, deletedAt: null, _id: { $ne: taskId } })
    .sort({ order: 1 })
    .select("_id order")
    .lean();
  const clamped = Math.max(0, Math.min(position, columnTasks.length));
  const prev = clamped === 0 ? null : (columnTasks[clamped - 1]?.order ?? null);
  const next = clamped >= columnTasks.length ? null : (columnTasks[clamped]?.order ?? null);
  const order = computeOrder(prev, next);
  const gapTiny = prev !== null && next !== null && next - prev < 1e-7;

  task.status = status;
  task.order = order;
  task.statusUpdatedAt = new Date();
  if (status === DONE_STATUS_KEY && !task.completedAt) task.completedAt = new Date();
  if (status !== DONE_STATUS_KEY) task.completedAt = null;
  await task.save();

  if (gapTiny) await normalizeColumnOrder(projectId, status);

  void logActivity({
    organizationId: String(task.organizationId),
    action: "task.move",
    actorId: actorUserId,
    entityType: "task",
    entityId: taskId,
    projectId,
    metadata: { from: fromStatus, to: status },
  });
  void publish([orgChannel(String(task.organizationId))], "task.moved", { id: taskId, projectId, from: fromStatus, to: status, order });
}

/* ------------------------------------------------------------------ */
/* Board                                                               */
/* ------------------------------------------------------------------ */

export async function getBoard(
  actorUserId: string,
  projectId: string,
  filters: { q?: string; assigneeId?: string; priority?: string; labelId?: string; due?: string } = {}
): Promise<BoardDTO> {
  await connectDb();
  await assertProjectPermission(actorUserId, projectId, "task.read");
  const project = await loadProject(projectId);

  const match: Record<string, unknown> = { projectId, deletedAt: null };
  const textScore = filters.q?.trim();
  if (textScore) {
    match.$text = { $search: textScore };
  }
  if (filters.assigneeId) match.assigneeId = filters.assigneeId;
  if (filters.priority) match.priority = filters.priority;
  if (filters.labelId) match.labels = { $elemMatch: { id: filters.labelId } };
  if (filters.due) {
    const now = new Date();
    if (filters.due === "overdue") match.dueDate = { $lt: now };
    else if (filters.due === "today") match.dueDate = { $gte: startOfDay(now), $lt: endOfDay(now) };
    else if (filters.due === "week") match.dueDate = { $gte: startOfDay(now), $lt: endOfDay(addDays(now, 7)) };
  }

  // Non-member can still view a public project but without board interactions.
  const tasksRaw = await Task.find(match)
    .sort({ order: 1 })
    .limit(BOARD_TASK_CAP)
    .lean();

  const enriched = await enrichTasks(tasksRaw, String(actorUserId), project.key);
  return {
    project: { id: projectId, name: project.name, key: project.key },
    statuses: project.statuses.map((s) => ({
      key: s.key,
      label: s.label,
      color: s.color,
      taskCount: tasksRaw.filter((t) => t.status === s.key).length,
    })),
    tasks: enriched,
    truncated: tasksRaw.length >= BOARD_TASK_CAP,
    myPermissions: {
      canCreate: true,
      canUpdate: true,
      canAssign: true,
    },
  } satisfies BoardDTO;
}

/* ------------------------------------------------------------------ */
/* Task CRUD                                                           */
/* ------------------------------------------------------------------ */

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: string;
  priority?: "none" | "low" | "medium" | "high" | "urgent";
  assigneeId?: string | null;
  dueDate?: Date | null;
  startDate?: Date | null;
  estimateMin?: number | null;
  labels?: { id: string; name: string; color: string }[];
  parentId?: string | null;
  sprintId?: string | null;
  milestoneId?: string | null;
}

export async function createTask(actorUserId: string, projectId: string, input: CreateTaskInput): Promise<TaskDTO> {
  await connectDb();
  await assertProjectPermission(actorUserId, projectId, "task.create");
  const project = await loadProject(projectId);
  const status = input.status ?? "backlog";
  const column = project.statuses.find((s) => s.key === status);
  if (!column) throw ApiError.badRequest(`Project has no "${status}" column.`);

  // Parent validation (same project, no cycles, depth limit).
  let parent: InstanceType<typeof Task> | null = null;
  if (input.parentId) {
    parent = await findTaskInProject(projectId, input.parentId);
    const depth = await taskDepth(parent);
    if (depth >= MAX_SUBTASK_DEPTH) {
      throw ApiError.unprocessable("Nexora supports up to three task levels (task → subtask → sub-subtask).");
    }
  }

  // Assignee/sprint/milestone belong to this org & project scope.
  const assigneeId = await resolveAssignee(project, actorUserId, input.assigneeId ?? null);
  if (input.sprintId) {
    const sprint = await Sprint.findOne({ _id: input.sprintId, projectId });
    if (!sprint) throw ApiError.badRequest("Sprint not found for this project.");
  }
  if (input.milestoneId) {
    const milestone = await Milestone.findOne({ _id: input.milestoneId, projectId });
    if (!milestone) throw ApiError.badRequest("Milestone not found for this project.");
  }

  const number = await nextTaskNumber(projectId);
  const maxOrder = await Task.findOne({ projectId, status, deletedAt: null }).sort({ order: -1 }).select("order").lean();
  const order = (maxOrder?.order ?? 0) + ORDER_STEP;

  const task = await Task.create({
    organizationId: project.organizationId,
    projectId,
    number,
    title: input.title,
    description: input.description ?? "",
    status,
    priority: input.priority ?? "none",
    assigneeId: assigneeId ?? null,
    reporterId: actorUserId,
    dueDate: input.dueDate ?? null,
    startDate: input.startDate ?? null,
    estimateMin: input.estimateMin ?? null,
    labels: input.labels ?? [],
    order,
    parentId: input.parentId ?? null,
    sprintId: input.sprintId ?? null,
    milestoneId: input.milestoneId ?? null,
    watchers: [actorUserId, ...(assigneeId ? [assigneeId] : [])],
    createdBy: actorUserId,
    statusUpdatedAt: new Date(),
    completedAt: status === DONE_STATUS_KEY ? new Date() : null,
  });

  if (parent) {
    // Inherit sprint from parent when none given (keeps boards consistent).
    if (!input.sprintId && parent.sprintId) {
      task.sprintId = parent.sprintId;
      await task.save();
    }
  }

  void logActivity({
    organizationId: String(project.organizationId),
    action: "task.create",
    actorId: actorUserId,
    entityType: "task",
    entityId: String(task._id),
    projectId,
    metadata: { key: `${project.key}-${number}`, status },
  });
  void publish([orgChannel(String(project.organizationId))], "task.created", {
    id: String(task._id),
    projectId,
    status,
    key: `${project.key}-${number}`,
  });
  void dispatchWebhookEvent(String(project.organizationId), "task.created", {
    id: String(task._id),
    projectId,
    number,
    key: `${project.key}-${number}`,
    title: task.title,
    status,
  });

  return toTaskDTO(task, actorUserId, project.key);
}

export async function getTaskDetail(actorUserId: string, projectId: string, taskId: string): Promise<TaskDTO> {
  await connectDb();
  await assertProjectPermission(actorUserId, projectId, "task.read");
  const project = await loadProject(projectId);
  const task = await findTaskInProject(projectId, taskId);
  return toTaskDTO(task, actorUserId, project.key);
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: string;
  priority?: "none" | "low" | "medium" | "high" | "urgent";
  assigneeId?: string | null;
  dueDate?: Date | null;
  startDate?: Date | null;
  estimateMin?: number | null;
  labels?: { id: string; name: string; color: string }[];
  parentId?: string | null;
  sprintId?: string | null;
  milestoneId?: string | null;
  watchers?: string[];
}

export async function updateTask(
  actorUserId: string,
  projectId: string,
  taskId: string,
  input: UpdateTaskInput
): Promise<TaskDTO> {
  await connectDb();
  await assertProjectPermission(actorUserId, projectId, "task.update");
  const project = await loadProject(projectId);
  const task = await findTaskInProject(projectId, taskId);
  let autoWatchAssignee: string | null = null;

  const patch: Record<string, unknown> = {};
  const changes: string[] = [];

  if (input.title !== undefined && input.title.trim()) {
    patch.title = input.title.trim();
    changes.push("title");
  }
  if (input.description !== undefined) {
    patch.description = input.description;
    changes.push("description");
  }
  if (input.priority !== undefined && input.priority !== task.priority) {
    patch.priority = input.priority;
    changes.push("priority");
  }
  if (input.status !== undefined && input.status !== task.status) {
    const column = project.statuses.find((s) => s.key === input.status);
    if (!column) throw ApiError.badRequest(`Project has no "${input.status}" column.`);
    patch.status = input.status;
    patch.statusUpdatedAt = new Date();
    if (input.status === DONE_STATUS_KEY) patch.completedAt = new Date();
    else patch.completedAt = null;
    changes.push("status");
  }
  if (input.dueDate !== undefined) {
    patch.dueDate = input.dueDate;
    changes.push("dueDate");
  }
  if (input.startDate !== undefined) {
    patch.startDate = input.startDate;
    changes.push("startDate");
  }
  if (input.estimateMin !== undefined) {
    patch.estimateMin = input.estimateMin;
    changes.push("estimate");
  }
  if (input.labels !== undefined) {
    patch.labels = input.labels;
    changes.push("labels");
  }

  // Assignee changes need task.assign; watchers need task.update (self-ok).
  if (input.assigneeId !== undefined) {
    await assertProjectPermission(actorUserId, projectId, "task.assign");
    const resolved = await resolveAssignee(project, actorUserId, input.assigneeId);
    const prev = task.assigneeId ? String(task.assigneeId) : null;
    if (resolved !== prev) {
      patch.assigneeId = resolved ?? null;
      changes.push("assignee");
      if (resolved && !task.watchers.some((w) => String(w) === resolved)) {
        autoWatchAssignee = resolved;
      }
    }
  }
  if (input.parentId !== undefined) {
    const newParent = input.parentId === null ? null : await findTaskInProject(projectId, input.parentId);
    await assertSafeParent(task, newParent, projectId);
    patch.parentId = newParent ? newParent._id : null;
    changes.push("parent");
  }
  if (input.sprintId !== undefined) {
    await assertProjectPermission(actorUserId, projectId, "sprint.manage");
    if (input.sprintId === null) patch.sprintId = null;
    else {
      const sprint = await Sprint.findOne({ _id: input.sprintId, projectId });
      if (!sprint) throw ApiError.badRequest("Sprint not found for this project.");
      patch.sprintId = sprint._id;
    }
    changes.push("sprint");
  }
  if (input.milestoneId !== undefined) {
    await assertProjectPermission(actorUserId, projectId, "milestone.manage");
    if (input.milestoneId === null) patch.milestoneId = null;
    else {
      const milestone = await Milestone.findOne({ _id: input.milestoneId, projectId });
      if (!milestone) throw ApiError.badRequest("Milestone not found for this project.");
      patch.milestoneId = milestone._id;
    }
    changes.push("milestone");
  }
  if (input.watchers !== undefined) {
    patch.watchers = [...new Set(input.watchers)];
    changes.push("watchers");
  }

  if (Object.keys(patch).length === 0) {
    return toTaskDTO(task, actorUserId, project.key);
  }
  Object.assign(task, patch);
  await task.save();
  if (autoWatchAssignee) {
    task.watchers.push(autoWatchAssignee as unknown as typeof task.watchers[number]);
    await Task.updateOne({ _id: task._id }, { $addToSet: { watchers: autoWatchAssignee } });
  }

  void logActivity({
    organizationId: String(project.organizationId),
    action: "task.update",
    actorId: actorUserId,
    entityType: "task",
    entityId: taskId,
    projectId,
    metadata: { changes },
  });
  void publish([orgChannel(String(project.organizationId))], "task.updated", { id: taskId, projectId, changes });
  void dispatchWebhookEvent(String(project.organizationId), "task.updated", {
    id: taskId,
    projectId,
    key: `${project.key}-${task.number}`,
    changes,
  });
  return toTaskDTO(task, actorUserId, project.key);
}

export async function deleteTask(actorUserId: string, projectId: string, taskId: string): Promise<void> {
  await connectDb();
  await assertProjectPermission(actorUserId, projectId, "task.delete");
  const task = await findTaskInProject(projectId, taskId);

  // Entity-level rule: reporters/assignees may delete their own tasks; others need manager+.
  const isReporter = String(task.reporterId) === actorUserId;
  const isAssignee = task.assigneeId && String(task.assigneeId) === actorUserId;
  if (!isReporter && !isAssignee) {
    await assertProjectPermission(actorUserId, projectId, "project.manageMembers").catch(() => {
      throw ApiError.forbidden("Only the reporter, assignee, or a project manager can delete this task.");
    });
  }

  await Task.updateMany({ parentId: task._id }, { $set: { deletedAt: new Date(), deletedBy: actorUserId } });
  task.deletedAt = new Date();
  task.deletedBy = actorUserId as unknown as typeof task.deletedBy; // mongoose casts string → ObjectId
  await task.save();
  void logActivity({
    organizationId: String(task.organizationId),
    action: "task.delete",
    actorId: actorUserId,
    entityType: "task",
    entityId: taskId,
    projectId,
    metadata: { title: task.title },
  });
  void publish([orgChannel(String(task.organizationId))], "task.deleted", { id: taskId, projectId });
  void dispatchWebhookEvent(String(task.organizationId), "task.deleted", {
    id: taskId,
    projectId,
    number: task.number,
    title: task.title,
  });
}

export async function taskDepth(task: InstanceType<typeof Task>): Promise<number> {
  let depth = 0;
  let current: InstanceType<typeof Task> | null = task;
  for (let i = 0; i < 8; i++) {
    if (!current || !current.parentId) return depth;
    current = await Task.findById(current.parentId).where("deletedAt").equals(null);
    if (!current) return depth;
    depth += 1;
  }
  return depth;
}

export async function taskDepthById(taskId: string): Promise<number> {
  const task = await Task.findById(taskId).where("deletedAt").equals(null);
  if (!task) return 0;
  return taskDepth(task as InstanceType<typeof Task>);
}

export const TASK_MAX_DEPTH = MAX_SUBTASK_DEPTH;

/** Prevent cycles and depth overflow when linking task → parent. */
async function assertSafeParent(
  task: InstanceType<typeof Task>,
  newParent: InstanceType<typeof Task> | null,
  projectId: string
): Promise<void> {
  if (!newParent) return;
  if (String(newParent._id) === String(task._id)) {
    throw ApiError.badRequest("A task cannot be its own parent.");
  }
  // Walk up: if we ever hit `task`, we'd form a cycle.
  let cursor: InstanceType<typeof Task> | null = newParent;
  for (let i = 0; i < 16 && cursor; i++) {
    if (String(cursor.parentId ?? "") === String(task._id)) {
      throw ApiError.badRequest("That would create a circular parent/child relationship.");
    }
    if (!cursor.parentId) break;
    cursor = await Task.findById(cursor.parentId).where("deletedAt").equals(null);
  }
  if (!cursor) throw ApiError.notFound("Parent task no longer exists.");
  const newDepth = await taskDepth(newParent) + 1;
  if (newDepth > MAX_SUBTASK_DEPTH) {
    throw ApiError.unprocessable("Nexora supports up to three task levels (task → subtask → sub-subtask).");
  }
  void projectId;
}

async function resolveAssignee(project: { organizationId: unknown }, actorUserId: string, assigneeId: string | null): Promise<string | null> {
  if (!assigneeId) return null;
  if (assigneeId === actorUserId) return actorUserId;
  const member = await Membership.findOne({ organizationId: project.organizationId, userId: assigneeId, status: "active" }).select("_id").lean();
  if (!member) throw ApiError.badRequest("Assignee must be an active member of this organization.");
  return assigneeId;
}

/* ------------------------------------------------------------------ */
/* Lists & enrichment                                                  */
/* ------------------------------------------------------------------ */

export async function listTasks(
  actorUserId: string,
  projectId: string,
  options: TaskListOptions
): Promise<{ items: TaskDTO[]; total: number; hasMore: boolean }> {
  await connectDb();
  await assertProjectPermission(actorUserId, projectId, "task.read");
  const project = await loadProject(projectId);

  const filter: Record<string, unknown> = { projectId, deletedAt: null };
  if (options.q?.trim()) filter.$text = { $search: options.q.trim() };
  if (options.status) filter.status = options.status;
  if (options.statuses?.length) filter.status = { $in: options.statuses };
  if (options.priority) filter.priority = options.priority;
  if (options.assigneeId) filter.assigneeId = options.assigneeId;
  if (options.reporterId) filter.reporterId = options.reporterId;
  if (options.labelId) filter.labels = { $elemMatch: { id: options.labelId } };
  if (options.sprintId) filter.sprintId = options.sprintId;
  if (options.milestoneId) filter.milestoneId = options.milestoneId;
  if (options.parentId !== undefined) filter.parentId = options.parentId === null ? null : options.parentId;

  if (options.due) {
    const now = new Date();
    if (options.due === "overdue") filter.dueDate = { $lt: now };
    if (options.due === "today") filter.dueDate = { $gte: startOfDay(now), $lt: endOfDay(now) };
    if (options.due === "week") filter.dueDate = { $gte: startOfDay(now), $lt: endOfDay(addDays(now, 7)) };
    if (options.due === "none") filter.dueDate = null;
  }
  const sortMap: Record<string, Record<string, 1 | -1>> = {
    updated: { updatedAt: -1 },
    created: { createdAt: -1 },
    dueDate: { dueDate: 1 },
    priority: { priority: -1 },
    number: { number: -1 },
  };
  const page = options.page || 1;
  const pageSize = Math.min(options.pageSize || PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX);

  const [raw, total] = await Promise.all([
    Task.find(filter).sort(sortMap[options.sort ?? "updated"]).skip((page - 1) * pageSize).limit(pageSize).lean(),
    Task.countDocuments(filter),
  ]);
  const items = await enrichTasks(raw, actorUserId, project.key);
  return { items, total, hasMore: page * pageSize < total };
}

/** Wires user infos + derived counts onto raw task docs. */
async function enrichTasks(raw: unknown[], actorUserId: string, projectKey: string): Promise<TaskDTO[]> {
  const tasks = raw as RichTask[];
  const ids = tasks.map((t) => String(t._id));
  const allUserIds = new Set<string>([actorUserId]);
  for (const t of tasks) {
    if (t.assigneeId) allUserIds.add(String(t.assigneeId));
    allUserIds.add(String(t.reporterId));
    if (t.createdBy) allUserIds.add(String(t.createdBy));
    for (const w of t.watchers ?? []) allUserIds.add(String(w));
  }

  const [users, commentAgg, fileAgg, subtaskAgg] = await Promise.all([
    getUserInfos([...allUserIds]),
    TaskComment.aggregate([
      { $match: { taskId: { $in: ids }, deletedAt: null } },
      { $group: { _id: "$taskId", count: { $sum: 1 } } },
    ]),
    File.aggregate([
      { $match: { ownerType: "task", ownerId: { $in: ids } } },
      { $group: { _id: "$ownerId", count: { $sum: 1 } } },
    ]),
    Task.aggregate([
      { $match: { parentId: { $in: ids }, deletedAt: null } },
      {
        $group: {
          _id: "$parentId",
          total: { $sum: 1 },
          done: { $sum: { $cond: [{ $eq: ["$status", DONE_STATUS_KEY] }, 1, 0] } },
        },
      },
    ]),
  ]);
  const commentMap = new Map(commentAgg.map((c) => [String(c._id), c.count as number]));
  const fileMap = new Map(fileAgg.map((f) => [String(f._id), f.count as number]));
  const subMap = new Map(subtaskAgg.map((s) => [String(s._id), s as { total: number; done: number }]));

  return tasks.map((t) => {
    const sub = subMap.get(String(t._id));
    const counts: TaskCounts = {
      commentCount: commentMap.get(String(t._id)) ?? 0,
      attachmentCount: fileMap.get(String(t._id)) ?? 0,
      subtaskCount: sub?.total ?? 0,
      completedSubtaskCount: sub?.done ?? 0,
    };
    return serializeTask(t, users, actorUserId, projectKey, counts);
  });
}

/** Build a full task DTO including subtask list + totals. */
export async function toTaskDTO(task: InstanceType<typeof Task>, actorUserId: string, projectKey: string): Promise<TaskDTO> {
  const ids = [String(task._id)];
  const subDocs = await Task.find({ parentId: task._id, deletedAt: null }).sort({ order: 1 }).lean();
  const subIds = subDocs.map((s) => String(s._id));
  const allUserIds = new Set<string>([actorUserId, String(task.reporterId)]);
  if (task.assigneeId) allUserIds.add(String(task.assigneeId));
  if (task.createdBy) allUserIds.add(String(task.createdBy));
  for (const w of task.watchers) allUserIds.add(String(w));
  for (const s of subDocs) {
    allUserIds.add(String(s.reporterId));
    if (s.assigneeId) allUserIds.add(String(s.assigneeId));
  }

  const [users, commentCount, attachmentCount, doneSubs, tracked, subChildren] = await Promise.all([
    getUserInfos([...allUserIds]),
    TaskComment.countDocuments({ taskId: task._id, deletedAt: null }),
    File.countDocuments({ ownerType: "task", ownerId: task._id }),
    Task.countDocuments({ parentId: task._id, deletedAt: null, status: DONE_STATUS_KEY }),
    TimeEntry.aggregate([
      { $match: { taskId: task._id, deletedAt: null } },
      { $group: { _id: null, total: { $sum: "$durationMs" } } },
    ]),
    subIds.length ? Task.find({ parentId: { $in: subIds }, deletedAt: null }).select("_id").lean() : [],
  ]);

  const childCounts = new Map<string, number>();
  for (const c of subChildren) childCounts.set(String(c.parentId), (childCounts.get(String(c.parentId)) ?? 0) + 1);

  const subtasks = subDocs.map((s) => ({
    id: String(s._id),
    title: s.title,
    status: s.status,
    assigneeId: s.assigneeId ? String(s.assigneeId) : null,
    dueDate: s.dueDate ? s.dueDate.toISOString() : null,
    priority: s.priority,
    order: s.order,
    hasChildren: (childCounts.get(String(s._id)) ?? 0) > 0,
  }));

  const counts: TaskCounts = {
    commentCount,
    attachmentCount,
    subtaskCount: subDocs.length,
    completedSubtaskCount: doneSubs,
  };
  return serializeTask(
    task as unknown as RichTask,
    users,
    actorUserId,
    projectKey,
    counts,
    subtasks,
    (tracked[0]?.total as number) ?? 0
  );
}

/* ------------------------------------------------------------------ */
/* Small date helpers (avoid date-fns on the server hot path)          */
/* ------------------------------------------------------------------ */
function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}
function endOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(23, 59, 59, 999);
  return copy;
}
function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}
