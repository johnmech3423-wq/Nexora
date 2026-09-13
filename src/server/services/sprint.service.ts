import { connectDb } from "@/server/db/db";
import { Sprint } from "@/server/db/models/sprint.model";
import { Project } from "@/server/db/models/project.model";
import { Task } from "@/server/db/models/task.model";
import { ApiError } from "@/server/errors";
import { assertProjectPermission } from "@/server/authorization/guard";
import { DONE_STATUS_KEY } from "@/lib/constants";
import { logActivity } from "@/server/services/activity.service";
import { publish, orgChannel } from "@/server/realtime/events";
import type { SprintDTO } from "@/types";

const DAY_MS = 86_400_000;

interface SprintBase {
  _id: unknown;
  projectId: unknown;
  name: string;
  goal: string | null;
  status: SprintDTO["status"];
  startDate: Date | null;
  endDate: Date | null;
  completedAt: Date | null;
  cancelledAt?: Date | null;
  createdAt: Date;
}

interface SprintWithCounts extends SprintBase {
  taskCount: number;
  completedTaskCount: number;
  totalPoints: number;
}

async function loadProjectOrg(projectId: string): Promise<string> {
  const p = await Project.findById(projectId).select("organizationId").lean();
  if (!p) throw ApiError.notFound();
  return String(p.organizationId);
}

async function findSprintInProject(projectId: string, sprintId: string): Promise<InstanceType<typeof Sprint>> {
  const sprint = await Sprint.findOne({ _id: sprintId, projectId });
  if (!sprint) throw ApiError.notFound("That sprint no longer exists.");
  return sprint;
}

async function withTaskCounts(s: SprintBase, now = Date.now()): Promise<SprintWithCounts> {
  void now;
  const agg = await Task.aggregate([
    { $match: { sprintId: s._id, deletedAt: null } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        done: { $sum: { $cond: [{ $eq: ["$status", DONE_STATUS_KEY] }, 1, 0] } },
        points: { $sum: { $ifNull: ["$estimateMin", 0] } },
      },
    },
  ]);
  const row = agg[0];
  return {
    ...s,
    taskCount: (row?.total as number) ?? 0,
    completedTaskCount: (row?.done as number) ?? 0,
    totalPoints: (row?.points as number) ?? 0,
  };
}

function serializeSprint(s: SprintWithCounts): SprintDTO {
  return {
    id: String(s._id),
    projectId: String(s.projectId),
    name: s.name,
    goal: s.goal,
    status: s.status,
    startDate: s.startDate ? s.startDate.toISOString() : null,
    endDate: s.endDate ? s.endDate.toISOString() : null,
    createdAt: s.createdAt.toISOString(),
    completedAt: s.completedAt ? s.completedAt.toISOString() : null,
    taskCount: s.taskCount,
    completedTaskCount: s.completedTaskCount,
    totalPoints: s.totalPoints,
  };
}

export async function listSprints(
  actorUserId: string,
  projectId: string,
  includeCompleted = true
): Promise<SprintDTO[]> {
  await connectDb();
  await assertProjectPermission(actorUserId, projectId, "task.read");
  const filter: Record<string, unknown> = { projectId };
  if (!includeCompleted) filter.status = { $in: ["planned", "active"] };
  const sprints = await Sprint.find(filter).sort({ startDate: -1, createdAt: -1 }).limit(50).lean();
  const withCounts = await Promise.all(sprints.map((s) => withTaskCounts(s)));
  return withCounts.map(serializeSprint);
}

export async function getSprint(actorUserId: string, projectId: string, sprintId: string): Promise<SprintDTO> {
  await connectDb();
  await assertProjectPermission(actorUserId, projectId, "task.read");
  const sprint = await findSprintInProject(projectId, sprintId);
  return serializeSprint(await withTaskCounts(sprint.toObject()));
}

export interface SprintInput {
  name: string;
  goal?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
}

export async function createSprint(actorUserId: string, projectId: string, input: SprintInput): Promise<SprintDTO> {
  await connectDb();
  await assertProjectPermission(actorUserId, projectId, "sprint.manage");
  const organizationId = await loadProjectOrg(projectId);
  const sprint = await Sprint.create({
    organizationId,
    projectId,
    name: input.name,
    goal: input.goal ?? null,
    status: "planned",
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
    createdBy: actorUserId,
  });
  void logActivity({
    organizationId,
    action: "sprint.create",
    actorId: actorUserId,
    entityType: "sprint",
    entityId: String(sprint._id),
    projectId,
  });
  return serializeSprint(await withTaskCounts(sprint.toObject()));
}

export async function updateSprint(
  actorUserId: string,
  projectId: string,
  sprintId: string,
  input: { name?: string; goal?: string | null; startDate?: Date | null; endDate?: Date | null }
): Promise<SprintDTO> {
  await connectDb();
  await assertProjectPermission(actorUserId, projectId, "sprint.manage");
  const sprint = await findSprintInProject(projectId, sprintId);
  if (sprint.status === "completed" || sprint.status === "cancelled") {
    throw ApiError.conflict("Completed sprints are locked.");
  }
  if (input.name !== undefined) sprint.name = input.name;
  if (input.goal !== undefined) sprint.goal = input.goal;
  if (input.startDate !== undefined) sprint.startDate = input.startDate;
  if (input.endDate !== undefined) sprint.endDate = input.endDate;
  await sprint.save();
  const organizationId = await loadProjectOrg(projectId);
  void publish([orgChannel(organizationId)], "sprint.started", { id: sprintId, projectId, action: "updated" });
  void logActivity({ organizationId, action: "sprint.update", actorId: actorUserId, entityType: "sprint", entityId: sprintId, projectId });
  return serializeSprint(await withTaskCounts(sprint.toObject()));
}

export async function startSprint(actorUserId: string, projectId: string, sprintId: string): Promise<SprintDTO> {
  await connectDb();
  await assertProjectPermission(actorUserId, projectId, "sprint.manage");
  const sprint = await findSprintInProject(projectId, sprintId);
  if (sprint.status !== "planned") throw ApiError.conflict("Only planned sprints can be started.");
  if (!sprint.endDate) throw ApiError.badRequest("Set an end date before starting the sprint.");
  if (sprint.endDate.getTime() < Date.now()) throw ApiError.badRequest("The sprint end date is in the past.");

  const active = await Sprint.countDocuments({ projectId, status: "active", _id: { $ne: sprint._id } });
  if (active > 0) throw ApiError.conflict("Another sprint is already active. Complete it first.");

  sprint.status = "active";
  sprint.startDate = sprint.startDate ?? new Date();
  await sprint.save();
  const organizationId = await loadProjectOrg(projectId);
  void publish([orgChannel(organizationId)], "sprint.started", { id: sprintId, projectId });
  void logActivity({ organizationId, action: "sprint.start", actorId: actorUserId, entityType: "sprint", entityId: sprintId, projectId });
  return serializeSprint(await withTaskCounts(sprint.toObject()));
}

export async function completeSprint(actorUserId: string, projectId: string, sprintId: string): Promise<SprintDTO> {
  await connectDb();
  await assertProjectPermission(actorUserId, projectId, "sprint.manage");
  const sprint = await findSprintInProject(projectId, sprintId);
  if (sprint.status !== "active") throw ApiError.conflict("Only an active sprint can be completed.");

  sprint.status = "completed";
  sprint.completedAt = new Date();
  sprint.endDate = sprint.endDate ?? new Date();
  await sprint.save();
  // Unfinished tasks roll back to the backlog so they stay visible.
  await Task.updateMany({ sprintId, status: { $ne: DONE_STATUS_KEY }, deletedAt: null }, { $set: { sprintId: null } });
  const organizationId = await loadProjectOrg(projectId);
  void publish([orgChannel(organizationId)], "sprint.completed", { id: sprintId, projectId });
  void logActivity({ organizationId, action: "sprint.complete", actorId: actorUserId, entityType: "sprint", entityId: sprintId, projectId });
  return serializeSprint(await withTaskCounts(sprint.toObject()));
}

export async function cancelSprint(actorUserId: string, projectId: string, sprintId: string): Promise<SprintDTO> {
  await connectDb();
  await assertProjectPermission(actorUserId, projectId, "sprint.manage");
  const sprint = await findSprintInProject(projectId, sprintId);
  if (sprint.status === "completed") throw ApiError.conflict("Completed sprints cannot be cancelled.");
  if (sprint.status === "cancelled") throw ApiError.conflict("This sprint is already cancelled.");

  sprint.status = "cancelled";
  sprint.cancelledAt = new Date();
  await sprint.save();
  await Task.updateMany({ sprintId, status: { $ne: DONE_STATUS_KEY }, deletedAt: null }, { $set: { sprintId: null } });
  const organizationId = await loadProjectOrg(projectId);
  void logActivity({ organizationId, action: "sprint.cancel", actorId: actorUserId, entityType: "sprint", entityId: sprintId, projectId });
  return serializeSprint(await withTaskCounts(sprint.toObject()));
}

export async function setSprintTasks(
  actorUserId: string,
  projectId: string,
  sprintId: string,
  taskIds: string[]
): Promise<{ assigned: number }> {
  await connectDb();
  await assertProjectPermission(actorUserId, projectId, "sprint.manage");
  const sprint = await findSprintInProject(projectId, sprintId);
  if (sprint.status === "completed") throw ApiError.conflict("Completed sprints cannot accept tasks.");

  const found = await Task.find({ _id: { $in: taskIds }, projectId, deletedAt: null }).select("_id").lean();
  const valid = new Set(found.map((t) => String(t._id)));
  const missing = taskIds.filter((id) => !valid.has(id));
  if (missing.length) throw ApiError.badRequest(`${missing.length} task(s) do not belong to this project.`);

  await Task.updateMany({ sprintId, deletedAt: null, _id: { $nin: taskIds } }, { $set: { sprintId: null } });
  await Task.updateMany({ _id: { $in: taskIds }, deletedAt: null }, { $set: { sprintId } });
  const organizationId = await loadProjectOrg(projectId);
  void logActivity({ organizationId, action: "sprint.update", actorId: actorUserId, entityType: "sprint", entityId: sprintId, projectId, metadata: { taskCount: taskIds.length } });
  return { assigned: taskIds.length };
}

/* ------------------------------------------------------------------ */
/* Burndown                                                            */
/* ------------------------------------------------------------------ */

export interface BurndownPoint {
  date: string;
  remaining: number;
  ideal: number;
}

export async function sprintBurndown(
  actorUserId: string,
  projectId: string,
  sprintId: string,
  days = 14
): Promise<{ points: BurndownPoint[]; total: number }> {
  await connectDb();
  await assertProjectPermission(actorUserId, projectId, "task.read");
  const sprint = await findSprintInProject(projectId, sprintId);
  const end = sprint.completedAt ?? new Date();
  const start = new Date(end.getTime() - (days - 1) * DAY_MS);

  const [total, completedRows] = await Promise.all([
    Task.countDocuments({ sprintId, deletedAt: null, createdAt: { $lte: end } }),
    Task.aggregate([
      { $match: { sprintId, deletedAt: null, completedAt: { $gte: start, $lte: end } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$completedAt" } }, count: { $sum: 1 } } },
    ]),
  ]);
  const doneByDay = new Map(completedRows.map((c) => [String(c._id), c.count as number]));

  const points: BurndownPoint[] = [];
  let done = 0;
  for (let i = 0; i < days; i++) {
    const day = new Date(start.getTime() + i * DAY_MS);
    const iso = day.toISOString().slice(0, 10);
    done += doneByDay.get(iso) ?? 0;
    const remaining = Math.max(0, total - done);
    points.push({ date: iso, remaining, ideal: Math.max(0, Math.round(total * (1 - (i + 1) / days))) });
  }
  return { points, total };
}
