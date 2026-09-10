import { connectDb } from "@/server/db/db";
import { Project, type ProjectDoc, type ProjectStatusSetting, type ProjectLabelDef } from "@/server/db/models/project.model";
import { ProjectMember } from "@/server/db/models/project-member.model";
import { FavoriteProject } from "@/server/db/models/favorite-project.model";
import { Membership } from "@/server/db/models/membership.model";
import { Organization } from "@/server/db/models/organization.model";
import { User } from "@/server/db/models/user.model";
import { Task } from "@/server/db/models/task.model";
import { Sprint } from "@/server/db/models/sprint.model";
import { Milestone } from "@/server/db/models/milestone.model";
import { ApiError } from "@/server/errors";
import { requireOrgPermission, requireOrgRole } from "@/server/services/org.service";
import { assertProjectPermission } from "@/server/authorization/guard";
import { resolveOrgContext } from "@/server/authorization/context";
import { projectRoleHasPermission, orgRoleHasPermission } from "@/lib/permissions";
import type { ProjectRole } from "@/lib/permissions";
import { DEFAULT_STATUSES, DONE_STATUS_KEY } from "@/lib/constants";
import { logActivity } from "@/server/services/activity.service";
import { dispatchWebhookEvent } from "@/server/services/webhook.service";

import { getUserInfos } from "@/server/db/lookups";
import { publish, orgChannel, projectChannel } from "@/server/realtime/events";
import type { ProjectSummaryDTO, ProjectDetailDTO, ProjectMemberDTO, ProjectStatusDTO } from "@/types";
import { serializeProjectMember, serializeStatusSetting } from "@/server/serializers/project";
import { Types } from "mongoose";

export interface ProjectListOptions {
  page: number;
  pageSize: number;
  q?: string;
  includeArchived?: boolean;
  sort?: "updated" | "created" | "name" | "dueDate";
}

export async function generateUniqueKey(organizationId: string, base: string): Promise<string> {
  let key = (base || "PRJ").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  if (!key || !/^[A-Z]/.test(key)) key = "PRJ";
  for (let suffix = 0; ; suffix++) {
    const candidate = suffix === 0 ? key : `${key.slice(0, 8 - String(suffix).length)}${suffix}`;
    const exists = await Project.exists({ organizationId, key: candidate });
    if (!exists) return candidate;
  }
}

const DEFAULT_LABEL_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#0ea5e9", "#6366f1", "#a855f7", "#ec4899"];

/* ------------------------------------------------------------------ */
/* Create                                                              */
/* ------------------------------------------------------------------ */

export async function createProject(
  actorUserId: string,
  orgIdOrSlug: string,
  input: {
    name: string;
    key?: string;
    description?: string;
    color?: string;
    startDate?: Date;
    dueDate?: Date;
    private?: boolean;
    managerUserIds?: string[];
  }
): Promise<ProjectDetailDTO> {
  await connectDb();
  const ctx = await requireOrgPermission(actorUserId, orgIdOrSlug, "project.create");
  const org = await Organization.findOne({ _id: ctx.organizationId, deletedAt: null }).lean();
  if (!org) throw ApiError.notFound();
  if (ctx.role === "member" && org.settings.allowMemberProjects === false) {
    throw ApiError.forbidden("Project creation is restricted to admins in this organization.");
  }

  const key = await generateUniqueKey(ctx.organizationId, input.key ?? slugKey(input.name));
  const statuses: ProjectStatusSetting[] = DEFAULT_STATUSES.map((s, i) => ({
    key: s.key,
    label: s.label,
    color: s.color,
    index: i,
  }));

  const project = await Project.create({
    organizationId: ctx.organizationId,
    name: input.name,
    key,
    description: input.description ?? null,
    color: input.color ?? null,
    ownerUserId: actorUserId,
    statuses,
    labels: DEFAULT_LABEL_COLORS.map((color, i) => ({
      id: labelId(i + 1),
      name: `Label ${i + 1}`,
      color,
    })),
    startDate: input.startDate ?? null,
    dueDate: input.dueDate ?? null,
    createdBy: actorUserId,
    settings: { private: input.private ?? false },
  });

  // Creator becomes a manager; extra managers must be org members.
  const managerIds = [...new Set([actorUserId, ...(input.managerUserIds ?? [])])];
  const members = await Membership.find({
    organizationId: ctx.organizationId,
    userId: { $in: managerIds },
    status: "active",
  })
    .select("userId")
    .lean();
  const validIds = new Set(members.map((m) => String(m.userId)));
  await ProjectMember.insertMany(
    [...validIds].map((userId) => ({
      projectId: project._id,
      userId,
      role: "manager" as ProjectRole,
      addedBy: actorUserId,
    }))
  );

  void logActivity({
    organizationId: ctx.organizationId,
    action: "project.create",
    actorId: actorUserId,
    entityType: "project",
    entityId: String(project._id),
    metadata: { name: project.name, key: project.key },
  });
  void publish([orgChannel(ctx.organizationId)], "project.updated", { id: String(project._id), action: "created" });
  void dispatchWebhookEvent(ctx.organizationId, "project.created", {
    id: String(project._id),
    name: project.name,
    key: project.key,
  });

  const detail = await getProjectDetail(actorUserId, String(project._id));
  return detail;
}

function slugKey(name: string): string {
  const cleaned = name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
  return cleaned.length >= 2 ? cleaned : "PRJ";
}

function labelId(i: number): string {
  return `lab${String(i).padStart(4, "0")}`;
}

/* ------------------------------------------------------------------ */
/* Read                                                                */
/* ------------------------------------------------------------------ */

/** List projects visible to the actor (org member + project visibility rules). */
export async function listProjects(
  actorUserId: string,
  orgIdOrSlug: string,
  options: ProjectListOptions
): Promise<{ items: ProjectSummaryDTO[]; total: number; hasMore: boolean }> {
  await connectDb();
  const ctx = await resolveOrgContext(actorUserId, orgIdOrSlug);
  await requireOrgPermission(actorUserId, ctx.organizationId, "project.read");
  const org = await Organization.findOne({ _id: ctx.organizationId }).lean();
  const restrictVisibility = org?.settings.restrictProjectVisibility === true;

  const filter: Record<string, unknown> = {
    organizationId: ctx.organizationId,
    deletedAt: null,
  };
  if (!options.includeArchived) filter.archivedAt = null;
  else filter.archivedAt = { $ne: null };

  // Non-admin sees only: public projects OR projects they belong to (when restricted) —
  // default orgs allow all members to see all active projects.
  const isAdmin = ctx.role === "owner" || ctx.role === "admin";
  if (!isAdmin && restrictVisibility) {
    const myProjects = await ProjectMember.find({ userId: actorUserId }).select("projectId").lean();
    const ids = myProjects.map((p) => p.projectId);
    filter.$or = [{ settings: { private: false } }, { _id: { $in: ids } }];
  }

  if (options.q) {
    filter.$text = { $search: options.q };
  }

  const sortMap: Record<string, Record<string, 1 | -1>> = {
    updated: { updatedAt: -1 },
    created: { createdAt: -1 },
    name: { name: 1 },
    dueDate: { dueDate: 1 },
  };
  const sort = sortMap[options.sort ?? "updated"];

  const [docs, total] = await Promise.all([
    Project.find(filter)
      .sort(sort)
      .skip((options.page - 1) * options.pageSize)
      .limit(options.pageSize)
      .lean(),
    Project.countDocuments(filter),
  ]);

  const summaries = await Promise.all(docs.map((p) => summarizeProject(actorUserId, p, ctx.role)));
  return { items: summaries, total, hasMore: options.page * options.pageSize < total };
}

/** Aggregates the summary numbers for one project (used by list + detail). */
async function summarizeProject(
  actorUserId: string,
  project: {
    _id: unknown;
    organizationId: unknown;
    key: string;
    name: string;
    description: string | null;
    color: string | null;
    statuses: ProjectStatusSetting[];
    startDate: Date | null;
    dueDate: Date | null;
    archivedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    ownerUserId: unknown;
  },
  orgRole: string
): Promise<ProjectSummaryDTO> {
  const [taskAgg, memberCount, pm] = await Promise.all([
    Task.aggregate([
      { $match: { projectId: project._id, deletedAt: null } },
      {
        $group: {
          _id: null,
          open: { $sum: { $cond: [{ $ne: ["$status", DONE_STATUS_KEY] }, 1, 0] } },
          done: { $sum: { $cond: [{ $eq: ["$status", DONE_STATUS_KEY] }, 1, 0] } },
          overdue: {
            $sum: {
              $cond: [
                { $and: [{ $lt: ["$dueDate", new Date()] }, { $ne: ["$status", DONE_STATUS_KEY] }, { $ne: ["$dueDate", null] }] },
                1,
                0,
              ],
            },
          },
          minDue: { $min: { $cond: [{ $and: [{ $ne: ["$dueDate", null] }, { $gte: ["$dueDate", new Date()] }] }, "$dueDate", null] } },
          maxUpdated: { $max: "$updatedAt" },
        },
      },
    ]),
    ProjectMember.countDocuments({ projectId: project._id }),
    ProjectMember.findOne({ projectId: project._id, userId: actorUserId }).select("role").lean(),
  ]);
  const agg = taskAgg[0];
  const open = agg?.open ?? 0;
  const done = agg?.done ?? 0;
  const total = open + done;
  const isAdmin = orgRole === "owner" || orgRole === "admin";

  const myRole: ProjectSummaryDTO["myRole"] = isAdmin ? "manager" : ((pm?.role ?? "none") as ProjectSummaryDTO["myRole"]);

  return {
    id: String(project._id),
    key: project.key,
    name: project.name,
    description: project.description,
    color: project.color,
    statuses: project.statuses.map(serializeStatusSetting),
    status: project.archivedAt ? "archived" : "active",
    startDate: project.startDate ? project.startDate.toISOString() : null,
    dueDate: project.dueDate ? project.dueDate.toISOString() : null,
    createdAt: project.createdAt.toISOString(),
    updatedAt: (agg?.maxUpdated ?? project.updatedAt).toISOString(),
    ownerName: null,
    memberCount,
    openTasks: open,
    completedTasks: done,
    progress: total === 0 ? 0 : Math.round((done / total) * 100),
    overdueTasks: agg?.overdue ?? 0,
    upcomingDeadline: agg?.minDue ? new Date(agg.minDue as Date).toISOString() : null,
    myRole,
  };
}

export async function getProjectDetail(actorUserId: string, projectId: string): Promise<ProjectDetailDTO> {
  await connectDb();
  await assertProjectPermission(actorUserId, projectId, "project.read");
  const project = await Project.findOne({ _id: projectId, deletedAt: null }).lean();
  if (!project) throw ApiError.notFound();
  const membership = await Membership.findOne({ organizationId: project.organizationId, userId: actorUserId }).select("role").lean();
  const summary = await summarizeProject(actorUserId, project, membership?.role ?? "guest");

  const [projectMembers, labelsUsed, ownerName, fav] = await Promise.all([
    listProjectMemberDtos(project._id.toString()),
    Task.distinct("labels", { projectId: project._id, deletedAt: null }),
    User.findById(project.ownerUserId).select("name").lean(),
    FavoriteProject.exists({ projectId: project._id, userId: actorUserId }),
  ]);

  const labelUseCount = new Map<string, number>();
  for (const l of labelsUsed as ProjectLabelDef[]) labelUseCount.set(l.id, (labelUseCount.get(l.id) ?? 0) + 1);

  return {
    ...summary,
    ownerName: ownerName?.name ?? null,
    members: projectMembers,
    labels: project.labels.map((l) => ({ ...l, used: labelUseCount.get(l.id) ?? 0 })),
    isFavorite: Boolean(fav),
  } satisfies ProjectDetailDTO;
}

export async function toggleProjectFavorite(actorUserId: string, projectId: string): Promise<{ favorite: boolean }> {
  await connectDb();
  await assertProjectPermission(actorUserId, projectId, "project.read");
  const project = await Project.findById(projectId).select("organizationId").lean();
  if (!project) throw ApiError.notFound();
  const existing = await FavoriteProject.findOne({ projectId, userId: actorUserId });
  if (existing) {
    await FavoriteProject.deleteOne({ _id: existing._id });
    return { favorite: false };
  }
  await FavoriteProject.create({ projectId, userId: actorUserId, organizationId: project.organizationId });
  return { favorite: true };
}

export async function listFavoriteProjects(actorUserId: string): Promise<{ projectId: string; name: string; key: string; color: string | null }[]> {
  await connectDb();
  const favs = await FavoriteProject.find({ userId: actorUserId }).sort({ createdAt: -1 }).limit(20).lean();
  if (favs.length === 0) return [];
  const projects = await Project.find({ _id: { $in: favs.map((f) => f.projectId) }, deletedAt: null, archivedAt: null })
    .select("_id name key color organizationId")
    .lean();
  const byId = new Map(projects.map((p) => [String(p._id), p]));
  return favs
    .map((f) => byId.get(String(f.projectId)))
    .filter(Boolean)
    .map((p) => ({ projectId: String(p!._id), name: p!.name, key: p!.key, color: p!.color }));
}

async function listProjectMemberDtos(projectId: string): Promise<ProjectMemberDTO[]> {
  const members = await ProjectMember.find({ projectId })
    .sort({ role: 1, createdAt: 1 })
    .lean();
  const userMap = await getUserInfos(members.map((m) => String(m.userId)));
  const orgRoles = await Membership.find({
    userId: { $in: [...userMap.keys()] },
  })
    .select("userId role")
    .lean();
  const roleByUser = new Map(orgRoles.map((m) => [String(m.userId), m.role]));
  const taskCounts = await Task.aggregate([
    { $match: { projectId, deletedAt: null, assigneeId: { $in: [...userMap.keys()] } } },
    { $group: { _id: "$assigneeId", count: { $sum: 1 } } },
  ]);
  const counts = new Map(taskCounts.map((t) => [String(t._id), t.count as number]));
  return members.map((m) =>
    serializeProjectMember(
      m,
      userMap.get(String(m.userId)) ?? { id: String(m.userId), name: "Unknown", email: "", avatarUrl: null },
      roleByUser.get(String(m.userId)) ?? "member",
      counts.get(String(m.userId)) ?? 0
    )
  );
}

/* ------------------------------------------------------------------ */
/* Update / archive / delete                                           */
/* ------------------------------------------------------------------ */

export async function updateProject(
  actorUserId: string,
  projectId: string,
  input: { name?: string; description?: string | null; color?: string | null; startDate?: Date | null; dueDate?: Date | null; private?: boolean }
): Promise<ProjectDetailDTO> {
  await connectDb();
  await assertProjectPermission(actorUserId, projectId, "project.update");
  const project = await Project.findById(projectId);
  if (!project || project.deletedAt) throw ApiError.notFound();

  const changes: string[] = [];
  if (input.name && input.name !== project.name) {
    project.name = input.name;
    changes.push("name");
  }
  if (input.description !== undefined) {
    if (input.description !== project.description) changes.push("description");
    project.description = input.description;
  }
  if (input.color !== undefined) {
    if (input.color !== project.color) changes.push("color");
    project.color = input.color;
  }
  if (input.startDate !== undefined) {
    if (String(input.startDate) !== String(project.startDate)) changes.push("startDate");
    project.startDate = input.startDate;
  }
  if (input.dueDate !== undefined) {
    if (String(input.dueDate) !== String(project.dueDate)) changes.push("dueDate");
    project.dueDate = input.dueDate;
  }
  if (input.private !== undefined && input.private !== project.settings.private) {
    changes.push("visibility");
    project.settings.private = input.private;
  }
  await project.save();

  void logActivity({
    organizationId: String(project.organizationId),
    action: "project.update",
    actorId: actorUserId,
    entityType: "project",
    entityId: projectId,
    projectId,
    metadata: { changes },
  });
  void publish([orgChannel(String(project.organizationId))], "project.updated", { id: projectId, changes });
  void dispatchWebhookEvent(String(project.organizationId), "project.updated", {
    id: projectId,
    name: project.name,
    key: project.key,
    changes,
  });
  return getProjectDetail(actorUserId, projectId);
}

export async function archiveProject(actorUserId: string, projectId: string, restore = false): Promise<void> {
  await connectDb();
  await assertProjectPermission(actorUserId, projectId, restore ? "project.update" : "project.archive");
  const project = await Project.findById(projectId);
  if (!project || project.deletedAt) throw ApiError.notFound();
  project.archivedAt = restore ? null : new Date();
  project.archivedBy = (restore ? null : new Types.ObjectId(actorUserId)) as unknown as ProjectDoc["archivedBy"];
  await project.save();
  void logActivity({
    organizationId: String(project.organizationId),
    action: restore ? "project.restore" : "project.archive",
    actorId: actorUserId,
    entityType: "project",
    entityId: projectId,
  });
}

export async function deleteProject(actorUserId: string, projectId: string): Promise<void> {
  await connectDb();
  await assertProjectPermission(actorUserId, projectId, "project.delete");
  const project = await Project.findById(projectId);
  if (!project || project.deletedAt) throw ApiError.notFound();
  if (!project.archivedAt) {
    throw ApiError.conflict("Archive the project before deleting it — this keeps accidental data loss away.");
  }
  project.deletedAt = new Date();
  await project.save();
  await Task.updateMany({ projectId }, { $set: { deletedAt: new Date(), deletedBy: actorUserId } });
  void logActivity({
    organizationId: String(project.organizationId),
    action: "project.delete",
    actorId: actorUserId,
    entityType: "project",
    entityId: projectId,
  });
  void dispatchWebhookEvent(String(project.organizationId), "project.deleted", {
    id: projectId,
    name: project.name,
    key: project.key,
  });
}

/* ------------------------------------------------------------------ */
/* Project members                                                     */
/* ------------------------------------------------------------------ */

export async function addProjectMember(
  actorUserId: string,
  projectId: string,
  userId: string,
  role: ProjectRole = "member"
): Promise<ProjectMemberDTO[]> {
  await connectDb();
  await assertProjectPermission(actorUserId, projectId, "project.manageMembers");
  const project = await Project.findById(projectId);
  if (!project || project.deletedAt) throw ApiError.notFound();

  const membership = await Membership.findOne({ organizationId: project.organizationId, userId, status: "active" }).lean();
  if (!membership) throw ApiError.badRequest("That user is not an active member of this organization.");

  const existing = await ProjectMember.findOne({ projectId, userId }).lean();
  if (existing) throw ApiError.conflict("That user is already on this project.");
  await ProjectMember.create({ projectId, userId, role, addedBy: actorUserId });

  void logActivity({
    organizationId: String(project.organizationId),
    action: "project.member_add",
    actorId: actorUserId,
    entityType: "project",
    entityId: projectId,
    metadata: { userId, role },
  });
  return listProjectMemberDtos(projectId);
}

export async function updateProjectMemberRole(
  actorUserId: string,
  projectId: string,
  userId: string,
  role: ProjectRole
): Promise<ProjectMemberDTO[]> {
  await connectDb();
  await assertProjectPermission(actorUserId, projectId, "project.manageMembers");
  const pm = await ProjectMember.findOne({ projectId, userId });
  if (!pm) throw ApiError.notFound("That user is not on this project.");
  pm.role = role;
  await pm.save();
  void logActivity({
    organizationId: String((await Project.findById(projectId))?.organizationId ?? ""),
    action: "project.member_role_update",
    actorId: actorUserId,
    entityType: "projectMember",
    entityId: String(pm._id),
    projectId,
    metadata: { userId, role },
  });
  return listProjectMemberDtos(projectId);
}

export async function removeProjectMember(actorUserId: string, projectId: string, userId: string): Promise<ProjectMemberDTO[]> {
  await connectDb();
  await assertProjectPermission(actorUserId, projectId, "project.manageMembers");
  const pm = await ProjectMember.findOne({ projectId, userId });
  if (!pm) throw ApiError.notFound("That user is not on this project.");
  if (pm.role === "manager" && pm.userId.toString() === actorUserId) {
    const managers = await ProjectMember.countDocuments({ projectId, role: "manager" });
    if (managers <= 1) throw ApiError.conflict("A project needs at least one manager.");
  }
  await ProjectMember.deleteOne({ _id: pm._id });
  await Task.updateMany({ projectId, assigneeId: userId }, { $set: { assigneeId: null } });
  void logActivity({
    organizationId: String((await Project.findById(projectId))?.organizationId ?? ""),
    action: "project.member_remove",
    actorId: actorUserId,
    entityType: "projectMember",
    entityId: String(pm._id),
    projectId,
    metadata: { userId },
  });
  void publish([projectChannel(String((await Project.findById(projectId))?.organizationId ?? ""), projectId)], "member.removed", { userId });
  return listProjectMemberDtos(projectId);
}

/* ------------------------------------------------------------------ */
/* Labels & custom statuses                                            */
/* ------------------------------------------------------------------ */

export async function createProjectLabel(actorUserId: string, projectId: string, input: { name: string; color: string }): Promise<ProjectLabelDef> {
  await connectDb();
  await assertProjectPermission(actorUserId, projectId, "project.update");
  const project = await Project.findById(projectId);
  if (!project || project.deletedAt) throw ApiError.notFound();
  if (project.labels.length >= 30) throw ApiError.unprocessable("A project can have up to 30 labels.");
  if (project.labels.some((l) => l.name.toLowerCase() === input.name.toLowerCase())) {
    throw ApiError.conflict("A label with this name already exists.");
  }
  const label: ProjectLabelDef = { id: labelId(project.labels.length + 1), name: input.name, color: input.color };
  project.labels.push(label);
  await project.save();
  return label;
}

export async function updateProjectLabel(
  actorUserId: string,
  projectId: string,
  labelId: string,
  input: { name?: string; color?: string }
): Promise<void> {
  await connectDb();
  await assertProjectPermission(actorUserId, projectId, "project.update");
  const project = await Project.findById(projectId);
  if (!project || project.deletedAt) throw ApiError.notFound();
  const label = project.labels.find((l) => l.id === labelId);
  if (!label) throw ApiError.notFound("Label not found.");
  if (input.name) {
    label.name = input.name;
    await Task.updateMany({ projectId, "labels.id": labelId }, { $set: { "labels.$.name": input.name } });
  }
  if (input.color) {
    label.color = input.color;
    await Task.updateMany({ projectId, "labels.id": labelId }, { $set: { "labels.$.color": input.color } });
  }
  await project.save();
}

export async function deleteProjectLabel(actorUserId: string, projectId: string, labelId: string): Promise<void> {
  await connectDb();
  await assertProjectPermission(actorUserId, projectId, "project.update");
  const project = await Project.findById(projectId);
  if (!project || project.deletedAt) throw ApiError.notFound();
  project.labels = project.labels.filter((l) => l.id !== labelId);
  await project.save();
  await Task.updateMany({ projectId, deletedAt: null }, { $pull: { labels: { id: labelId } } });
}

/**
 * Replace the project's status config (order/rename/recolor/add/remove).
 * Safety: cannot remove a status that still contains tasks; "done" (or the
 * configured terminal status) cannot be removed while tasks use it.
 */
export async function updateProjectStatuses(
  actorUserId: string,
  projectId: string,
  statuses: { key: string; label: string; color: string }[]
): Promise<ProjectStatusDTO[]> {
  await connectDb();
  await assertProjectPermission(actorUserId, projectId, "project.update");
  const project = await Project.findById(projectId);
  if (!project || project.deletedAt) throw ApiError.notFound();

  const incoming = new Map(statuses.map((s) => [s.key, s]));
  const usage = await Task.aggregate([
    { $match: { projectId, deletedAt: null } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  for (const row of usage) {
    const key = String(row._id);
    if (!incoming.has(key)) {
      throw ApiError.conflict(
        `Status "${key}" still has ${row.count} task(s). Move them before removing it.`
      );
    }
  }
  if (!incoming.has(DONE_STATUS_KEY)) {
    // The terminal column is structural for completions & burndown.
    const doneUsage = usage.find((u) => String(u._id) === DONE_STATUS_KEY);
    if (!doneUsage) {
      throw ApiError.unprocessable(`Keep a "${DONE_STATUS_KEY}" status — Nexora uses it as the completion column.`);
    }
  }
  project.statuses = statuses.map((s, i) => ({ ...s, index: i }));
  await project.save();
  void logActivity({
    organizationId: String(project.organizationId),
    action: "project.status_update",
    actorId: actorUserId,
    entityType: "project",
    entityId: projectId,
    metadata: { statuses: statuses.map((s) => s.key) },
  });
  void publish([orgChannel(String(project.organizationId))], "project.updated", { id: projectId, action: "statuses" });
  return project.statuses.map(serializeStatusSetting);
}

