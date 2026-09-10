import { connectDb } from "@/server/db/db";
import { Milestone } from "@/server/db/models/milestone.model";
import { Project } from "@/server/db/models/project.model";
import { Task } from "@/server/db/models/task.model";
import { ApiError } from "@/server/errors";
import { assertProjectPermission } from "@/server/authorization/guard";
import { DONE_STATUS_KEY } from "@/lib/constants";
import { logActivity } from "@/server/services/activity.service";
import type { MilestoneDTO } from "@/types";

interface MilestoneBase {
  _id: unknown;
  projectId: unknown;
  name: string;
  description: string | null;
  dueDate: Date | null;
  createdAt: Date;
  completedAt: Date | null;
}

interface MilestoneWithProgress extends MilestoneBase {
  progress: number;
  taskCount: number;
  completedTaskCount: number;
  status: MilestoneDTO["status"];
}

async function loadProjectOrg(projectId: string): Promise<string> {
  const p = await Project.findById(projectId).select("organizationId").lean();
  if (!p) throw ApiError.notFound();
  return String(p.organizationId);
}

async function findMilestone(projectId: string, milestoneId: string): Promise<InstanceType<typeof Milestone>> {
  const milestone = await Milestone.findOne({ _id: milestoneId, projectId });
  if (!milestone) throw ApiError.notFound("That milestone no longer exists.");
  return milestone;
}

/** Progress derived from task data at read time — no counters to drift. */
async function withProgress(m: MilestoneBase, now = Date.now()): Promise<MilestoneWithProgress> {
  const agg = await Task.aggregate([
    { $match: { milestoneId: m._id, deletedAt: null } },
    { $group: { _id: null, total: { $sum: 1 }, done: { $sum: { $cond: [{ $eq: ["$status", DONE_STATUS_KEY] }, 1, 0] } } } },
  ]);
  const row = agg[0];
  const total = (row?.total as number) ?? 0;
  const done = (row?.done as number) ?? 0;
  const isOverdue = Boolean(m.dueDate && m.dueDate.getTime() < now && done < total);
  const isComplete = total > 0 && done === total;
  const status: MilestoneDTO["status"] = isComplete ? "completed" : isOverdue ? "overdue" : total === 0 ? "planned" : "active";
  return {
    ...m,
    progress: total === 0 ? 0 : Math.round((done / total) * 100),
    taskCount: total,
    completedTaskCount: done,
    status,
  };
}

function serializeMilestone(m: MilestoneWithProgress): MilestoneDTO {
  return {
    id: String(m._id),
    projectId: String(m.projectId),
    name: m.name,
    description: m.description,
    dueDate: m.dueDate ? m.dueDate.toISOString() : null,
    createdAt: m.createdAt.toISOString(),
    completedAt: m.completedAt ? m.completedAt.toISOString() : null,
    status: m.status,
    progress: m.progress,
    taskCount: m.taskCount,
    completedTaskCount: m.completedTaskCount,
  };
}

export async function listMilestones(actorUserId: string, projectId: string): Promise<MilestoneDTO[]> {
  await connectDb();
  await assertProjectPermission(actorUserId, projectId, "task.read");
  const milestones = await Milestone.find({ projectId }).sort({ dueDate: 1 }).limit(100).lean();
  const items = await Promise.all(milestones.map((m) => withProgress(m)));
  return items.map(serializeMilestone);
}

export async function getMilestone(actorUserId: string, projectId: string, milestoneId: string): Promise<MilestoneDTO> {
  await connectDb();
  await assertProjectPermission(actorUserId, projectId, "task.read");
  const milestone = await findMilestone(projectId, milestoneId);
  return serializeMilestone(await withProgress(milestone.toObject()));
}

export interface MilestoneInput {
  name: string;
  description?: string | null;
  dueDate?: Date | null;
}

export async function createMilestone(actorUserId: string, projectId: string, input: MilestoneInput): Promise<MilestoneDTO> {
  await connectDb();
  await assertProjectPermission(actorUserId, projectId, "milestone.manage");
  const organizationId = await loadProjectOrg(projectId);
  const milestone = await Milestone.create({
    organizationId,
    projectId,
    name: input.name,
    description: input.description ?? null,
    dueDate: input.dueDate ?? null,
    createdBy: actorUserId,
  });
  void logActivity({
    organizationId,
    action: "milestone.create",
    actorId: actorUserId,
    entityType: "milestone",
    entityId: String(milestone._id),
    projectId,
  });
  return serializeMilestone(await withProgress(milestone.toObject()));
}

export async function updateMilestone(
  actorUserId: string,
  projectId: string,
  milestoneId: string,
  input: { name?: string; description?: string | null; dueDate?: Date | null }
): Promise<MilestoneDTO> {
  await connectDb();
  await assertProjectPermission(actorUserId, projectId, "milestone.manage");
  const milestone = await findMilestone(projectId, milestoneId);
  const current = await withProgress(milestone.toObject());
  if (current.status === "completed") {
    throw ApiError.conflict("This milestone is complete. Reopen linked tasks to edit it.");
  }
  if (input.name !== undefined) milestone.name = input.name;
  if (input.description !== undefined) milestone.description = input.description;
  if (input.dueDate !== undefined) milestone.dueDate = input.dueDate;
  await milestone.save();
  const organizationId = await loadProjectOrg(projectId);
  void logActivity({ organizationId, action: "milestone.update", actorId: actorUserId, entityType: "milestone", entityId: milestoneId, projectId });
  return serializeMilestone(await withProgress(milestone.toObject()));
}

export async function deleteMilestone(actorUserId: string, projectId: string, milestoneId: string): Promise<void> {
  await connectDb();
  await assertProjectPermission(actorUserId, projectId, "milestone.manage");
  const milestone = await findMilestone(projectId, milestoneId);
  await Task.updateMany({ milestoneId }, { $set: { milestoneId: null } });
  await Milestone.deleteOne({ _id: milestone._id });
  const organizationId = await loadProjectOrg(projectId);
  void logActivity({
    organizationId,
    action: "milestone.delete",
    actorId: actorUserId,
    entityType: "milestone",
    entityId: milestoneId,
    projectId,
    metadata: { name: milestone.name },
  });
}

/** Overdue milestones across the org (dashboards, reminders). */
export async function listOverdueMilestones(actorUserId: string, organizationId: string, limit = 20): Promise<MilestoneDTO[]> {
  await connectDb();
  const all = await Milestone.find({ organizationId, dueDate: { $lt: new Date() }, completedAt: null })
    .sort({ dueDate: 1 })
    .limit(limit)
    .lean();
  const items = await Promise.all(all.map(async (m) => (await withProgress(m)).status === "overdue" ? serializeMilestone(await withProgress(m)) : null));
  void actorUserId;
  return items.filter((x): x is MilestoneDTO => x !== null);
}
