/* ------------------------------------------------------------------ */
/* Time tracking service (timers + manual entries).                    */
/* Rules: one running timer per user; entries belong to tasks;         */
/* authors + org owners/admins may edit; every op checks the actor's   */
/* project permission first.                                           */
/* ------------------------------------------------------------------ */
import { ApiError } from "@/server/errors";
import { connectDb } from "@/server/db/db";
import { TimeEntry } from "@/server/db/models/time-entry.model";
import { Task } from "@/server/db/models/task.model";
import { Project } from "@/server/db/models/project.model";
import { assertProjectPermission, assertOrgPermission } from "@/server/authorization/guard";
import { logActivity } from "@/server/services/activity.service";
import { getUserInfos } from "@/server/db/lookups";
import { toAssignee } from "@/server/serializers/task";
import type { TimeEntryDTO } from "@/types";
import { TIME_ENTRY_MAX_MS as MAX } from "@/lib/constants";
import { Types } from "mongoose";

const toId = (s: string) => new Types.ObjectId(s);

type TaskLean = {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  projectId: Types.ObjectId;
  number: number;
  title: string;
};

type EntryLean = {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  projectId: Types.ObjectId;
  taskId: Types.ObjectId;
  userId: Types.ObjectId;
  description: string | null;
  startAt: Date;
  endAt: Date | null;
  durationMs: number;
  source: "timer" | "manual";
};

/** Task may belong to any project; resolves task meta + its project key. */
async function loadTask(taskId: string): Promise<{ taskId: string; projectId: string; key: string; title: string; organizationId: string }> {
  await connectDb();
  const raw = (await Task.findOne({ _id: toId(taskId), deletedAt: null })
    .select("projectId number title organizationId")
    .lean()) as unknown as TaskLean | null;
  if (!raw) throw ApiError.notFound("That task does not exist.");
  const project = (await Project.findById(String(raw.projectId)).select("key name").lean()) as unknown as {
    key: string;
    name: string;
  } | null;
  const projectKey = project?.key ?? "?";
  return {
    taskId,
    projectId: String(raw.projectId),
    key: `${projectKey}-${raw.number}`,
    title: raw.title,
    organizationId: String(raw.organizationId),
  };
}

async function serializeEntry(entry: EntryLean & { taskKey: string; taskTitle: string }, projectNames: Map<string, string>): Promise<TimeEntryDTO> {
  const taskId = String(entry.taskId);
  const projectId = String(entry.projectId);
  const userId = String(entry.userId);
  const users = await getUserInfos([userId]);
  const user = toAssignee(users.get(userId)) ?? { userId, name: "Unknown", email: "", avatarUrl: null };
  return {
    id: String(entry._id),
    taskId,
    taskKey: entry.taskKey,
    taskTitle: entry.taskTitle,
    projectId,
    projectName: projectNames.get(projectId) ?? "Untitled",
    user,
    description: entry.description ?? null,
    startAt: entry.startAt.toISOString(),
    endAt: entry.endAt ? entry.endAt.toISOString() : null,
    durationMs: entry.durationMs,
    source: entry.source,
    canDelete: true,
  };
}

/** Project names for an entry list. */
async function projectNamesFor(projectIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(projectIds)].filter(Boolean);
  if (!unique.length) return new Map();
  const docs = await Project.find({ _id: { $in: unique } }).select("_id name").lean();
  return new Map(docs.map((p) => [String(p._id), p.name]));
}

export async function listTaskTimeEntries(
  actorUserId: string,
  taskId: string,
  opts: { page?: number; pageSize?: number } = {}
): Promise<{ items: TimeEntryDTO[]; total: number; totalMs: number; hasMore: boolean }> {
  const task = await loadTask(taskId);
  await assertProjectPermission(actorUserId, task.projectId, "task.read");
  const page = opts.page ?? 1;
  const pageSize = Math.min(opts.pageSize ?? 20, 100);
  const filter = { taskId: toId(taskId), deletedAt: null };
  const [rows, total] = await Promise.all([
    TimeEntry.find(filter).sort({ startAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    TimeEntry.countDocuments(filter),
  ]);
  const agg = await TimeEntry.aggregate<{ totalMs: number }>([
    { $match: { taskId: toId(taskId), deletedAt: null } },
    { $group: { _id: null, totalMs: { $sum: { $ifNull: ["$durationMs", 0] } } } },
  ]);
  const names = await projectNamesFor([task.projectId]);
  const items: TimeEntryDTO[] = [];
  for (const r of rows as unknown as EntryLean[]) {
    items.push(await serializeEntry({ ...r, taskKey: task.key, taskTitle: task.title }, names));
  }
  return { items, total, totalMs: agg[0]?.totalMs ?? 0, hasMore: page * pageSize < total };
}

/** Starts the caller's timer on a task (one running timer per user). */
export async function startTimer(
  actorUserId: string,
  taskId: string,
  description: string | null
): Promise<{ entry: TimeEntryDTO; running: { entryId: string; taskId: string; taskKey: string; taskTitle: string; startedAt: string; elapsedMs: number } }> {
  const task = await loadTask(taskId);
  await assertProjectPermission(actorUserId, task.projectId, "time.track");
  await connectDb();

  const running = (await TimeEntry.findOne({ userId: toId(actorUserId), endAt: null, deletedAt: null }).lean()) as unknown as EntryLean | null;
  if (running) {
    throw ApiError.conflict("You already have a running timer. Stop it before starting a new one.");
  }
  const now = new Date();
  const doc = await TimeEntry.create({
    organizationId: toId(task.organizationId),
    projectId: toId(task.projectId),
    taskId: toId(taskId),
    userId: toId(actorUserId),
    description: description || null,
    startAt: now,
    endAt: null,
    durationMs: 0,
    source: "timer",
  });
  const names = await projectNamesFor([task.projectId]);
  const entry = await serializeEntry({ ...(doc.toObject() as unknown as EntryLean), taskKey: task.key, taskTitle: task.title }, names);
  void logActivity({
    organizationId: task.organizationId,
    actorId: actorUserId,
    action: "time_entry.start",
    entityType: "task",
    entityId: taskId,
    projectId: task.projectId,
    metadata: { taskKey: task.key },
  });
  return {
    entry,
    running: { entryId: String(doc._id), taskId, taskKey: task.key, taskTitle: task.title, startedAt: now.toISOString(), elapsedMs: 0 },
  };
}

/** Stops the caller's running timer (optionally restricted to a task). */
export async function stopTimer(
  actorUserId: string,
  taskId?: string | null
): Promise<{ entry: TimeEntryDTO | null; elapsedMs: number }> {
  await connectDb();
  const filter: Record<string, unknown> = { userId: toId(actorUserId), endAt: null, deletedAt: null };
  if (taskId) filter.taskId = toId(taskId);
  const running = (await TimeEntry.findOne(filter).lean()) as unknown as EntryLean | null;
  if (!running) throw ApiError.conflict("No running timer to stop.");
  const task = await loadTask(String(running.taskId));
  await assertProjectPermission(actorUserId, task.projectId, "time.track");

  const endAt = new Date();
  const start = running.startAt;
  const elapsedMs = Math.max(0, endAt.getTime() - start.getTime());
  const doc = await TimeEntry.findByIdAndUpdate(
    String(running._id),
    { $set: { endAt, durationMs: elapsedMs } },
    { new: true }
  );
  if (!doc) throw ApiError.notFound("Timer entry not found.");
  const names = await projectNamesFor([task.projectId]);
  const entry = await serializeEntry({ ...(doc.toObject() as unknown as EntryLean), taskKey: task.key, taskTitle: task.title }, names);
  void logActivity({
    organizationId: task.organizationId,
    actorId: actorUserId,
    action: "time_entry.stop",
    entityType: "task",
    entityId: task.taskId,
    projectId: task.projectId,
    metadata: { elapsedMs },
  });
  return { entry, elapsedMs };
}

export async function createManualEntry(
  actorUserId: string,
  taskId: string,
  input: { description?: string; startAt: Date; endAt: Date }
): Promise<TimeEntryDTO> {
  const task = await loadTask(taskId);
  await assertProjectPermission(actorUserId, task.projectId, "time.track");
  const start = input.startAt;
  const end = input.endAt;
  if (end.getTime() <= start.getTime()) throw ApiError.badRequest("End time must be after the start time.");
  const durationMs = end.getTime() - start.getTime();
  if (durationMs > MAX) throw ApiError.badRequest("A single time entry may not exceed 24 hours.");

  const doc = await TimeEntry.create({
    organizationId: toId(task.organizationId),
    projectId: toId(task.projectId),
    taskId: toId(taskId),
    userId: toId(actorUserId),
    description: input.description || null,
    startAt: start,
    endAt: end,
    durationMs,
    source: "manual",
  });
  const names = await projectNamesFor([task.projectId]);
  return serializeEntry({ ...(doc.toObject() as unknown as EntryLean), taskKey: task.key, taskTitle: task.title }, names);
}

export async function getRunningTimer(
  actorUserId: string,
  organizationId: string
): Promise<{
  entryId: string;
  taskId: string;
  taskKey: string;
  taskTitle: string;
  startedAt: string;
  elapsedMs: number;
} | null> {
  await assertOrgPermission(actorUserId, organizationId, "time.track");
  await connectDb();
  const running = (await TimeEntry.findOne({ userId: toId(actorUserId), endAt: null, deletedAt: null }).lean()) as unknown as EntryLean | null;
  if (!running) return null;
  const task = await loadTask(String(running.taskId));
  const startedAt = running.startAt;
  return {
    entryId: String(running._id),
    taskId: String(running.taskId),
    taskKey: task.key,
    taskTitle: task.title,
    startedAt: startedAt.toISOString(),
    elapsedMs: Math.max(0, Date.now() - startedAt.getTime()),
  };
}

/** Org-wide time report (permissions: analytics.read on the org). */
export async function orgTimeReport(
  actorUserId: string,
  organizationId: string,
  filters: { userId?: string; projectId?: string; taskId?: string; from?: Date; to?: Date; page?: number; pageSize?: number }
): Promise<{
  items: TimeEntryDTO[];
  total: number;
  totalMs: number;
  hasMore: boolean;
  perUser: { userId: string; totalMs: number }[];
}> {
  await assertOrgPermission(actorUserId, organizationId, "analytics.read");
  await connectDb();
  const page = filters.page ?? 1;
  const pageSize = Math.min(filters.pageSize ?? 20, 100);

  const match: Record<string, unknown> = { organizationId: toId(organizationId), deletedAt: null };
  if (filters.userId) match.userId = toId(filters.userId);
  if (filters.projectId) match.projectId = toId(filters.projectId);
  if (filters.taskId) match.taskId = toId(filters.taskId);
  const timeFilter: Record<string, unknown> = {};
  if (filters.from) timeFilter.$gte = filters.from;
  if (filters.to) timeFilter.$lte = filters.to;
  if (Object.keys(timeFilter).length) match.startAt = timeFilter;

  const [rows, total, totals, perUser] = await Promise.all([
    TimeEntry.find(match).sort({ startAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    TimeEntry.countDocuments(match),
    TimeEntry.aggregate<{ totalMs: number }>([{ $match: match }, { $group: { _id: null, totalMs: { $sum: { $ifNull: ["$durationMs", 0] } } } }]),
    TimeEntry.aggregate<{ _id: string; totalMs: number }>([
      { $match: match },
      { $group: { _id: "$userId", totalMs: { $sum: { $ifNull: ["$durationMs", 0] } } } },
      { $sort: { totalMs: -1 } },
      { $limit: 50 },
    ]),
  ]);

  // Resolve task number/title + project names & keys in bulk.
  const entryRows = rows as unknown as EntryLean[];
  const taskIds = [...new Set(entryRows.map((r) => String(r.taskId)))];
  const tasks = taskIds.length
    ? await Task.find({ _id: { $in: taskIds } }).select("_id number title projectId").lean()
    : [];
  const taskMeta = new Map(
    (tasks as unknown as { _id: Types.ObjectId; number: number; title: string; projectId: Types.ObjectId }[]).map((t) => [
      String(t._id),
      { number: t.number, title: t.title, projectId: String(t.projectId) },
    ])
  );
  const metaProjectIds = [...new Set(taskMeta.values())].map((t) => t.projectId);
  const keyProjects = metaProjectIds.length
    ? await Project.find({ _id: { $in: metaProjectIds } }).select("_id key").lean()
    : [];
  const projectKeyBy = new Map(
    (keyProjects as unknown as { _id: Types.ObjectId; key: string }[]).map((p) => [String(p._id), p.key])
  );
  const projectIds = [...new Set([...entryRows.map((r) => String(r.projectId)), ...taskMeta.keys()].map((id) => String(id)))];
  const names = await projectNamesFor(projectIds);

  const items: TimeEntryDTO[] = [];
  for (const r of entryRows) {
    const meta = taskMeta.get(String(r.taskId));
    items.push(
      await serializeEntry(
        {
          ...r,
          taskKey: meta ? `${projectKeyBy.get(meta.projectId) ?? "?"}-${meta.number}` : "?",
          taskTitle: meta?.title ?? "Deleted task",
        },
        names
      )
    );
  }
  return {
    items,
    total,
    totalMs: totals[0]?.totalMs ?? 0,
    hasMore: page * pageSize < total,
    perUser: perUser.map((p) => ({ userId: String(p._id), totalMs: p.totalMs })),
  };
}

export async function deleteTimeEntry(actorUserId: string, entryId: string): Promise<void> {
  await connectDb();
  const raw = (await TimeEntry.findOne({ _id: toId(entryId), deletedAt: null }).lean()) as unknown as (EntryLean & { deletedAt: Date | null }) | null;
  if (!raw) throw ApiError.notFound("Time entry not found.");
  const entry = raw as EntryLean & { deletedAt: Date | null };
  const task = await loadTask(String(entry.taskId));
  const { orgRole } = await assertProjectPermission(actorUserId, task.projectId, "task.read");
  // Authors + org owners/admins may delete; other members cannot delete others' entries.
  const isAuthor = String(entry.userId) === actorUserId;
  if (!isAuthor && orgRole !== "owner" && orgRole !== "admin") {
    throw ApiError.forbidden("Only the person who logged the time, or an organization admin, can remove it.");
  }

  await TimeEntry.updateOne({ _id: entry._id }, { $set: { deletedAt: new Date() } });
  void logActivity({
    organizationId: String(entry.organizationId),
    actorId: actorUserId,
    action: "time_entry.delete",
    entityType: "task",
    entityId: String(entry.taskId),
    projectId: task.projectId,
    metadata: { durationMs: entry.durationMs },
  });
}
