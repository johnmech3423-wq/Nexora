/* ------------------------------------------------------------------ */
/* Calendar service — one merged timeline of task deadlines,           */
/* milestone dates and sprint windows, scoped to visible projects.     */
/* ------------------------------------------------------------------ */
import { connectDb } from "@/server/db/db";
import { Task } from "@/server/db/models/task.model";
import { Project } from "@/server/db/models/project.model";
import { Milestone } from "@/server/db/models/milestone.model";
import { Sprint } from "@/server/db/models/sprint.model";
import { ProjectMember } from "@/server/db/models/project-member.model";
import { assertOrgPermission } from "@/server/authorization/guard";
import { getUserInfos } from "@/server/db/lookups";
import { toAssignee, emptyPerson } from "@/server/serializers/task";
import type { Types } from "mongoose";

export interface CalendarEvent {
  id: string;
  type: "task" | "milestone" | "sprint";
  title: string;
  start: string | null; // ISO
  end: string | null;
  allDay: boolean;
  status: string | null;
  projectId: string;
  projectName: string;
  projectKey: string;
  assignee: { userId: string; name: string; avatarUrl: string | null } | null;
  url: string;
}

const toId = (s: string) => s;

async function visibleProjects(actorUserId: string, organizationId: string): Promise<{ id: string; name: string; key: string }[]> {
  await connectDb();
  const projects = (await Project.find({ organizationId: toId(organizationId), deletedAt: null })
    .select("_id name key settings.private")
    .lean()) as unknown as { _id: Types.ObjectId; name: string; key: string; settings: { private: boolean } }[];
  const privateIds = projects.filter((p) => p.settings.private).map((p) => String(p._id));
  let allowed: Set<string> = new Set();
  if (privateIds.length) {
    const rows = await ProjectMember.find({ projectId: { $in: privateIds }, userId: toId(actorUserId) }).select("projectId").lean();
    allowed = new Set(rows.map((r) => String(r.projectId)));
  }
  return projects
    .filter((p) => !p.settings.private || allowed.has(String(p._id)))
    .map((p) => ({ id: String(p._id), name: p.name, key: p.key }));
}

export async function calendarEvents(
  actorUserId: string,
  orgIdOrSlug: string,
  opts: { from: Date; to: Date; projectId?: string | null }
): Promise<CalendarEvent[]> {
  const ctx = await assertOrgPermission(actorUserId, orgIdOrSlug, "calendar.read");
  const visible = await visibleProjects(actorUserId, ctx.organizationId);
  const projects = opts.projectId ? visible.filter((p) => p.id === opts.projectId) : visible;
  if (!projects.length) return [];
  const byId = new Map(projects.map((p) => [p.id, p]));
  const projectIds = projects.map((p) => p.id);
  await connectDb();

  const [tasks, milestones, sprints] = await Promise.all([
    Task.find({
      organizationId: toId(ctx.organizationId),
      projectId: { $in: projectIds.map(toId) },
      deletedAt: null,
      dueDate: { $gte: opts.from, $lte: opts.to },
    })
      .select("_id title status dueDate projectId assigneeId number")
      .limit(400)
      .lean(),
    Milestone.find({
      organizationId: toId(ctx.organizationId),
      projectId: { $in: projectIds.map(toId) },
      deletedAt: null,
      dueDate: { $gte: opts.from, $lte: opts.to },
    })
      .select("_id name dueDate status projectId")
      .limit(200)
      .lean(),
    Sprint.find({
      organizationId: toId(ctx.organizationId),
      projectId: { $in: projectIds.map(toId) },
      $or: [
        { startDate: { $lte: opts.to, $gte: opts.from } },
        { endDate: { $gte: opts.from, $lte: opts.to } },
        { startDate: { $lte: opts.from }, endDate: { $gte: opts.to } },
      ],
    })
      .select("_id name status startDate endDate projectId")
      .limit(100)
      .lean(),
  ]);

  const assigneeIds = [
    ...new Set((tasks as unknown as { assigneeId?: Types.ObjectId | null }[]).map((t) => (t.assigneeId ? String(t.assigneeId) : "")).filter(Boolean)),
  ];
  const users = await getUserInfos(assigneeIds);

  const events: CalendarEvent[] = [];
  for (const t of tasks as unknown as { _id: Types.ObjectId; title: string; status: string; dueDate: Date; projectId: Types.ObjectId; assigneeId?: Types.ObjectId | null; number?: number }[]) {
    const p = byId.get(String(t.projectId));
    if (!p) continue;
    const info = t.assigneeId ? users.get(String(t.assigneeId)) : undefined;
    events.push({
      id: `task-${String(t._id)}`,
      type: "task",
      title: `${p.key}-${t.number ?? ""} ${t.title}`.trim(),
      start: t.dueDate.toISOString(),
      end: t.dueDate.toISOString(),
      allDay: true,
      status: t.status,
      projectId: p.id,
      projectName: p.name,
      projectKey: p.key,
      assignee: t.assigneeId ? toAssignee(info) ?? emptyPerson(String(t.assigneeId)) : null,
      url: `/projects/${p.id}/board?task=${String(t._id)}`,
    });
  }
  for (const m of milestones as unknown as { _id: Types.ObjectId; name: string; dueDate: Date; status: string; projectId: Types.ObjectId }[]) {
    const p = byId.get(String(m.projectId));
    if (!p) continue;
    events.push({
      id: `milestone-${String(m._id)}`,
      type: "milestone",
      title: `${m.name}`,
      start: m.dueDate.toISOString(),
      end: m.dueDate.toISOString(),
      allDay: true,
      status: m.status,
      projectId: p.id,
      projectName: p.name,
      projectKey: p.key,
      assignee: null,
      url: `/projects/${p.id}?milestone=${String(m._id)}`,
    });
  }
  for (const s of sprints as unknown as { _id: Types.ObjectId; name: string; status: string; startDate: Date | null; endDate: Date | null; projectId: Types.ObjectId }[]) {
    const p = byId.get(String(s.projectId));
    if (!p) continue;
    if (!s.startDate && !s.endDate) continue;
    events.push({
      id: `sprint-${String(s._id)}`,
      type: "sprint",
      title: `${s.name}`,
      start: s.startDate ? s.startDate.toISOString() : null,
      end: s.endDate ? s.endDate.toISOString() : null,
      allDay: false,
      status: s.status,
      projectId: p.id,
      projectName: p.name,
      projectKey: p.key,
      assignee: null,
      url: `/projects/${p.id}/sprints`,
    });
  }
  events.sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""));
  return events;
}
