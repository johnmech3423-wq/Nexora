/* ------------------------------------------------------------------ */
/* Analytics service — aggregation pipelines over org-scoped data.     */
/* Kept read-only: summaries + trends + distributions + workload +     */
/* team velocity. Every query is tenant-scoped by organizationId.      */
/* ------------------------------------------------------------------ */
import { connectDb } from "@/server/db/db";
import { Task } from "@/server/db/models/task.model";
import { Project } from "@/server/db/models/project.model";
import { Sprint } from "@/server/db/models/sprint.model";
import { TimeEntry } from "@/server/db/models/time-entry.model";
import { ActivityLog } from "@/server/db/models/activity-log.model";
import { Membership } from "@/server/db/models/membership.model";
import { Session } from "@/server/db/models/session.model";
import { assertOrgPermission } from "@/server/authorization/guard";
import { assertPlanFeature } from "@/server/services/billing.service";
import { getUserInfos } from "@/server/db/lookups";
import { toAssignee, emptyPerson } from "@/server/serializers/task";
import type { AnalyticsSummaryDTO, TrendPoint, PriorityDist, StatusDist, WorkloadPoint } from "@/types";
import { DONE_STATUS_KEY } from "@/lib/constants";
import { Types } from "mongoose";

const toId = (s: string) => new Types.ObjectId(s);

/** Which of an org's projects may a user see (used to scope analytics). */
async function visibleProjectIds(actorUserId: string, organizationId: string): Promise<string[]> {
  await connectDb();
  const projects = (await Project.find({ organizationId: toId(organizationId), deletedAt: null })
    .select("_id settings.private")
    .lean()) as unknown as { _id: Types.ObjectId; settings: { private: boolean } }[];
  const privateIds = projects.filter((p) => p.settings.private).map((p) => String(p._id));
  let allowedPrivate: Set<string> = new Set();
  if (privateIds.length) {
    const { ProjectMember } = await import("@/server/db/models/project-member.model");
    const rows = await ProjectMember.find({ projectId: { $in: privateIds }, userId: toId(actorUserId) })
      .select("projectId")
      .lean();
    allowedPrivate = new Set(rows.map((r) => String(r.projectId)));
  }
  return projects.filter((p) => !p.settings.private || allowedPrivate.has(String(p._id))).map((p) => String(p._id));
}

export async function orgSummary(
  actorUserId: string,
  orgIdOrSlug: string
): Promise<AnalyticsSummaryDTO> {
  const ctx = await assertOrgPermission(actorUserId, orgIdOrSlug, "analytics.read");
  await connectDb();
  const orgId = ctx.organizationId;
  const visibleIds = await visibleProjectIds(actorUserId, orgId);

  const taskMatch: Record<string, unknown> = {
    organizationId: toId(orgId),
    deletedAt: null,
    projectId: { $in: visibleIds.map(toId) },
  };
  const now = new Date();

  const doneCond = { $eq: ["$status", DONE_STATUS_KEY] };
  const overdueCond = { $and: [{ $ne: ["$status", DONE_STATUS_KEY] }, { $lt: ["$dueDate", now] }] };

  const [projectAgg, taskAgg, memberTotal, activeToday, activity24h, sprintAgg] = await Promise.all([
    Project.aggregate<{ total: number; archived: number }>([
      { $match: { organizationId: toId(orgId), deletedAt: null, _id: { $in: visibleIds.map(toId) } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          archived: { $sum: { $cond: [{ $ne: ["$archivedAt", null] }, 1, 0] } },
        },
      },
    ]),
    Task.aggregate<{ total: number; open: number; completed: number; overdue: number }>([
      { $match: taskMatch },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          open: { $sum: { $cond: [{ $ne: ["$status", DONE_STATUS_KEY] }, 1, 0] } },
          completed: { $sum: { $cond: [doneCond, 1, 0] } },
          overdue: { $sum: { $cond: [overdueCond, 1, 0] } },
        },
      },
    ]),
    Membership.countDocuments({ organizationId: toId(orgId), status: "active" }),
    Session.countDocuments({
      lastActiveAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      expiresAt: { $gt: now },
      revokedAt: null,
    }),
    ActivityLog.countDocuments({
      organizationId: toId(orgId),
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    }),
    Sprint.aggregate<{ total: number; active: number; completed: number }>([
      { $match: { organizationId: toId(orgId), status: { $in: ["active", "completed", "planned"] } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } },
          completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
        },
      },
    ]),
  ]);

  const tasks = taskAgg[0];
  const projects = projectAgg[0];
  const sprints = sprintAgg[0];
  const totalTasks = tasks?.total ?? 0;
  const completedTasks = tasks?.completed ?? 0;

  const cycle = await Task.aggregate<{ avgMs: number }>([
    { $match: { ...taskMatch, status: DONE_STATUS_KEY, doneAt: { $ne: null } } },
    { $project: { ms: { $subtract: ["$doneAt", "$createdAt"] } } },
    { $group: { _id: null, avgMs: { $avg: "$ms" } } },
  ]);
  const avgCycleDays =
    cycle[0] && cycle[0].avgMs > 0 ? Math.round((cycle[0].avgMs / 86_400_000) * 10) / 10 : null;

  let teamVelocity: AnalyticsSummaryDTO["teamVelocity"];
  const advanced = await assertPlanFeature(orgId, "advancedAnalytics").catch(() => null);
  if (advanced) {
    teamVelocity = await computeVelocity(orgId, visibleIds);
  }

  return {
    projects: {
      total: projects?.total ?? 0,
      active: (projects?.total ?? 0) - (projects?.archived ?? 0),
      archived: projects?.archived ?? 0,
      completed: 0,
    },
    tasks: {
      total: totalTasks,
      open: tasks?.open ?? 0,
      completed: completedTasks,
      overdue: tasks?.overdue ?? 0,
      completionRate: totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0,
      avgCycleDays,
    },
    members: { total: memberTotal, activeToday },
    activity: { last24h: activity24h },
    sprints: {
      total: sprints?.total ?? 0,
      active: sprints?.active ?? 0,
      completed: sprints?.completed ?? 0,
    },
    teamVelocity,
  };
}

async function computeVelocity(
  orgId: string,
  visibleIds: string[]
): Promise<AnalyticsSummaryDTO["teamVelocity"]> {
  const completed = (await Sprint.find({
    organizationId: toId(orgId),
    projectId: { $in: visibleIds.map(toId) },
    status: "completed",
  })
    .select("_id projectId completedAt")
    .limit(300)
    .lean()) as unknown as { _id: Types.ObjectId; projectId: Types.ObjectId; completedAt: Date | null }[];
  if (!completed.length) return [];
  const sprintIds = completed.map((s) => String(s._id));
  const rows = await Task.aggregate<{ _id: string; done: number; total: number }>([
    { $match: { sprintId: { $in: sprintIds.map(toId) }, deletedAt: null } },
    { $group: { _id: "$sprintId", done: { $sum: { $cond: [{ $eq: ["$status", DONE_STATUS_KEY] }, 1, 0] } }, total: { $sum: 1 } } },
  ]);
  const projects = (await Project.find({ _id: { $in: visibleIds.map(toId) } }).select("_id name").lean()) as unknown as {
    _id: Types.ObjectId;
    name: string;
  }[];
  const pName = new Map(projects.map((p) => [String(p._id), p.name]));
  const byProject = new Map<string, { sum: number; count: number; last: Date | null }>();
  for (const s of completed) {
    const stats = rows.find((r) => String(r._id) === String(s._id));
    const key = String(s.projectId);
    const entry = byProject.get(key) ?? { sum: 0, count: 0, last: null };
    entry.sum += stats && stats.total ? stats.done / stats.total : 0;
    entry.count += 1;
    if (s.completedAt && (!entry.last || s.completedAt > entry.last)) entry.last = s.completedAt;
    byProject.set(key, entry);
  }
  return [...byProject.entries()].map(([projectId, v]) => ({
    projectId,
    projectName: pName.get(projectId) ?? "Untitled",
    velocity: Math.round((v.sum / Math.max(v.count, 1)) * 100) / 100,
    lastSprintDate: v.last ? v.last.toISOString() : null,
  }));
}

/** Completion/creation trend bucketed per day over N days. */
export async function trends(
  actorUserId: string,
  orgIdOrSlug: string,
  days = 30
): Promise<TrendPoint[]> {
  const ctx = await assertOrgPermission(actorUserId, orgIdOrSlug, "analytics.read");
  await assertPlanFeature(ctx.organizationId, "advancedAnalytics");
  const visible = await visibleProjectIds(actorUserId, ctx.organizationId);
  if (!visible.length) return [];
  await connectDb();
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (days - 1));

  const projectMatch = { projectId: { $in: visible.map(toId) } };
  const [createdRows, completedRows, overdueRows] = await Promise.all([
    Task.aggregate([
      { $match: { organizationId: toId(ctx.organizationId), ...projectMatch, createdAt: { $gte: since }, deletedAt: null } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "UTC" } }, n: { $sum: 1 } } },
    ]),
    Task.aggregate([
      { $match: { organizationId: toId(ctx.organizationId), ...projectMatch, doneAt: { $gte: since }, deletedAt: null } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$doneAt", timezone: "UTC" } }, n: { $sum: 1 } } },
    ]),
    Task.aggregate([
      { $match: { organizationId: toId(ctx.organizationId), ...projectMatch, dueDate: { $lt: new Date() }, status: { $ne: DONE_STATUS_KEY }, deletedAt: null } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$dueDate", timezone: "UTC" } }, n: { $sum: 1 } } },
    ]),
  ]);

  const toMap = (rows: { _id: string; n: number }[]) => new Map(rows.map((r) => [r._id, r.n]));
  const created = toMap(createdRows as { _id: string; n: number }[]);
  const completed = toMap(completedRows as { _id: string; n: number }[]);
  const overdueByDay = toMap(overdueRows as { _id: string; n: number }[]);

  const out: TrendPoint[] = [];
  const day = since;
  const lastKey = new Date().toISOString().slice(0, 10);
  for (let i = 0; i < days; i++) {
    const key = day.toISOString().slice(0, 10);
    out.push({
      date: key,
      completed: completed.get(key) ?? 0,
      created: created.get(key) ?? 0,
      overdue: key === lastKey ? overdueByDay.get(key) ?? 0 : 0,
    });
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return out;
}

export async function distributions(
  actorUserId: string,
  orgIdOrSlug: string
): Promise<{ priority: PriorityDist[]; status: StatusDist[] }> {
  const ctx = await assertOrgPermission(actorUserId, orgIdOrSlug, "analytics.read");
  await assertPlanFeature(ctx.organizationId, "advancedAnalytics");
  const visible = await visibleProjectIds(actorUserId, ctx.organizationId);
  await connectDb();
  const projectDocs = (await Project.find({ _id: { $in: visible.map(toId) } })
    .select("statuses")
    .lean()) as unknown as { statuses: { key: string; label: string; color: string }[] }[];
  const statusMap = new Map<string, { label: string; color: string }>();
  for (const doc of projectDocs) {
    for (const st of doc.statuses) statusMap.set(st.key, { label: st.label, color: st.color });
  }

  const match = { organizationId: toId(ctx.organizationId), projectId: { $in: visible.map(toId) }, deletedAt: null };
  const [priorityRows, statusRows] = await Promise.all([
    Task.aggregate<{ _id: string; count: number }>([
      { $match: { ...match, status: { $ne: DONE_STATUS_KEY } } },
      { $group: { _id: "$priority", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Task.aggregate<{ _id: string; count: number }>([
      { $match: match },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);
  return {
    priority: priorityRows.map((r) => ({ priority: r._id, count: r.count })),
    status: statusRows.map((r) => ({
      status: r._id,
      label: statusMap.get(r._id)?.label ?? r._id,
      color: statusMap.get(r._id)?.color ?? "#64748b",
      count: r.count,
    })),
  };
}

export async function workload(actorUserId: string, orgIdOrSlug: string): Promise<WorkloadPoint[]> {
  const ctx = await assertOrgPermission(actorUserId, orgIdOrSlug, "analytics.read");
  await assertPlanFeature(ctx.organizationId, "advancedAnalytics");
  const visible = await visibleProjectIds(actorUserId, ctx.organizationId);
  if (!visible.length) return [];
  await connectDb();
  const memberDocs = await Membership.find({ organizationId: toId(ctx.organizationId), status: "active" })
    .select("userId")
    .lean();
  const memberIds = memberDocs.map((m) => String(m.userId));
  const memberObjectIds = memberIds.map(toId);
  const now = new Date();

  const match = {
    organizationId: toId(ctx.organizationId),
    projectId: { $in: visible.map(toId) },
    assigneeId: { $in: memberObjectIds },
    deletedAt: null,
  };
  const [taskRows, timeRows] = await Promise.all([
    Task.aggregate<{ _id: string; open: number; inProgress: number; completed: number; overdue: number }>([
      { $match: match },
      {
        $group: {
          _id: "$assigneeId",
          open: { $sum: { $cond: [{ $not: [{ $in: ["$status", [DONE_STATUS_KEY, "in_progress"]] }] }, 1, 0] } },
          inProgress: { $sum: { $cond: [{ $eq: ["$status", "in_progress"] }, 1, 0] } },
          completed: { $sum: { $cond: [{ $eq: ["$status", DONE_STATUS_KEY] }, 1, 0] } },
          overdue: { $sum: { $cond: [{ $and: [{ $ne: ["$status", DONE_STATUS_KEY] }, { $lt: ["$dueDate", now] }] }, 1, 0] } },
        },
      },
    ]),
    TimeEntry.aggregate<{ _id: string; ms: number }>([
      { $match: { organizationId: toId(ctx.organizationId), userId: { $in: memberObjectIds }, deletedAt: null } },
      { $group: { _id: "$userId", ms: { $sum: { $ifNull: ["$durationMs", 0] } } } },
    ]),
  ]);
  const users = await getUserInfos(memberIds);
  const timeMap = new Map(timeRows.map((r) => [String(r._id), r.ms]));
  return memberIds.map((id) => {
    const t = taskRows.find((r) => String(r._id) === id);
    return {
      user: toAssignee(users.get(id)) ?? emptyPerson(id),
      open: t?.open ?? 0,
      inProgress: t?.inProgress ?? 0,
      completed: t?.completed ?? 0,
      overdue: t?.overdue ?? 0,
      totalTrackedMs: timeMap.get(id) ?? 0,
    };
  });
}
