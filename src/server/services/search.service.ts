/* ------------------------------------------------------------------ */
/* Global search — MongoDB full-text indexes (project/task/comment/    */
/* message) scoped to what the actor may see, with type-aware results. */
/* ------------------------------------------------------------------ */
import { connectDb } from "@/server/db/db";
import { Project } from "@/server/db/models/project.model";
import { Task } from "@/server/db/models/task.model";
import { TaskComment } from "@/server/db/models/task-comment.model";
import { Message } from "@/server/db/models/message.model";
import { Conversation } from "@/server/db/models/conversation.model";
import { Membership } from "@/server/db/models/membership.model";
import { ProjectMember } from "@/server/db/models/project-member.model";
import { User } from "@/server/db/models/user.model";
import { resolveOrgContext } from "@/server/authorization/context";
import { Types } from "mongoose";

export interface SearchResult {
  query: string;
  projects: { id: string; name: string; key: string; description: string | null }[];
  tasks: { id: string; key: string; title: string; status: string; priority: string; projectId: string }[];
  comments: { id: string; body: string; taskId: string; taskKey: string; projectId: string }[];
  messages: { id: string; body: string; conversationId: string; conversationName: string; projectId: string | null }[];
  members: { userId: string; name: string; email: string; avatarUrl: string | null }[];
  total: number;
}

const toId = (s: string) => new Types.ObjectId(s);

async function visibleProjectIds(actorUserId: string, organizationId: string): Promise<string[]> {
  await connectDb();
  const projects = (await Project.find({ organizationId: toId(organizationId), deletedAt: null })
    .select("_id settings.private")
    .lean()) as unknown as { _id: Types.ObjectId; settings: { private: boolean } }[];
  const privateIds = projects.filter((p) => p.settings.private).map((p) => String(p._id));
  let allowedPrivate: Set<string> = new Set();
  if (privateIds.length) {
    const rows = await ProjectMember.find({ projectId: { $in: privateIds }, userId: toId(actorUserId) }).select("projectId").lean();
    allowedPrivate = new Set(rows.map((r) => String(r.projectId)));
  }
  return projects.filter((p) => !p.settings.private || allowedPrivate.has(String(p._id))).map((p) => String(p._id));
}

/** Build a quoted phrase for $text that tolerates spaces/symbols. */
function phrase(query: string): string | null {
  const cleaned = query.trim().replace(/["\\]/g, " ").replace(/\s+/g, " ").slice(0, 80);
  if (cleaned.length < 2) return null;
  return `"${cleaned}"`;
}

function snippet(body: string, max = 140): string {
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length > max ? flat.slice(0, max - 1) + "…" : flat;
}

export async function globalSearch(
  actorUserId: string,
  orgIdOrSlug: string,
  rawQuery: string
): Promise<SearchResult> {
  const ctx = await resolveOrgContext(actorUserId, orgIdOrSlug);
  const q = rawQuery.trim();
  const empty: SearchResult = { query: q, projects: [], tasks: [], comments: [], messages: [], members: [], total: 0 };
  if (q.length < 1) return empty;

  await connectDb();
  const orgId = ctx.organizationId;
  const visible = await visibleProjectIds(actorUserId, orgId);
  const text = phrase(q);

  const [projectRows, taskRows, commentRows, messageRows, memberRows] = await Promise.all([
    text
      ? Project.aggregate([
          { $match: { organizationId: toId(orgId), deletedAt: null, _id: { $in: visible.map(toId) }, $text: { $search: text } } },
          { $project: { name: 1, key: 1, description: 1, score: { $meta: "textScore" } } },
          { $sort: { score: { $meta: "textScore" } } },
          { $limit: 5 },
        ])
      : Project.aggregate([
          { $match: { organizationId: toId(orgId), deletedAt: null, _id: { $in: visible.map(toId) }, name: new RegExp(`^${escapeRegExp(q)}`, "i") } },
          { $limit: 5 },
        ]),
    text
      ? Task.aggregate([
          { $match: { organizationId: toId(orgId), deletedAt: null, projectId: { $in: visible.map(toId) }, $text: { $search: text } } },
          { $project: { title: 1, status: 1, priority: 1, projectId: 1, number: 1, score: { $meta: "textScore" } } },
          { $sort: { score: { $meta: "textScore" } } },
          { $limit: 10 },
        ])
      : Task.aggregate([
          { $match: { organizationId: toId(orgId), deletedAt: null, projectId: { $in: visible.map(toId) }, title: new RegExp(`^${escapeRegExp(q)}`, "i") } },
          { $project: { title: 1, status: 1, priority: 1, projectId: 1, number: 1 } },
          { $limit: 10 },
        ]),
    text
      ? TaskComment.aggregate([
          { $match: { organizationId: toId(orgId), projectId: { $in: visible.map(toId) }, deletedAt: null, $text: { $search: text } } },
          { $project: { body: 1, taskId: 1, projectId: 1, score: { $meta: "textScore" } } },
          { $sort: { score: { $meta: "textScore" } } },
          { $limit: 6 },
        ])
      : Promise.resolve([]),
    Promise.resolve([]),
    User.aggregate([
      {
        $match: {
          _id: {
            $in: (
              await Membership.find({ organizationId: toId(orgId), status: "active" }).select("userId").lean()
            ).map((m) => toId(String(m.userId))),
          },
          $or: [{ name: new RegExp(escapeRegExp(q), "i") }, { email: new RegExp(`^${escapeRegExp(q)}`, "i") }],
        },
      },
      { $limit: 8 },
    ]),
  ]);

  // Resolve task keys for comments (project key + number).
  const commentTaskIds = [...new Set(commentRows.map((c) => String(c.taskId)))];
  const taskDocs = commentTaskIds.length
    ? await Task.find({ _id: { $in: commentTaskIds } }).select("_id number projectId").lean()
    : [];
  const taskKeyByComment = new Map(
    (taskDocs as unknown as { _id: Types.ObjectId; number: number; projectId: Types.ObjectId }[]).map((t) => [
      String(t._id),
      { number: t.number, projectId: String(t.projectId) },
    ])
  );

  // Messages: search only conversations I can read.
  let messageOut: SearchResult["messages"] = [];
  if (text) {
    const mine = await Conversation.find({
      organizationId: toId(orgId),
      type: { $in: ["dm", "group"] },
      memberIds: toId(actorUserId),
    })
      .select("_id name type memberIds")
      .lean();
    const channels = await Conversation.find({ organizationId: toId(orgId), projectId: { $in: visible.map(toId) } })
      .select("_id name projectId")
      .lean();
    const convs = [...(mine as unknown as { _id: Types.ObjectId; name: string | null }[]), ...(channels as unknown as { _id: Types.ObjectId; name: string | null; projectId: Types.ObjectId | null }[])];
    const convIds = convs.map((c) => String(c._id));
    if (convIds.length) {
      const rows = await Message.aggregate([
        {
          $match: {
            organizationId: toId(orgId),
            conversationId: { $in: convIds.map(toId) },
            deletedAt: null,
            $text: { $search: text },
          },
        },
        { $project: { body: 1, conversationId: 1, score: { $meta: "textScore" } } },
        { $sort: { score: { $meta: "textScore" } } },
        { $limit: 6 },
      ]);
      const convById = new Map(convs.map((c) => [String(c._id), c as { name?: string | null; projectId?: Types.ObjectId | null }]));
      messageOut = rows.map((r) => {
        const c = convById.get(String(r.conversationId));
        return {
          id: String(r._id),
          body: snippet(r.body as string),
          conversationId: String(r.conversationId),
          conversationName: c?.name ?? "Conversation",
          projectId: c?.projectId ? String(c.projectId) : null,
        };
      });
    }
  }

  // Task keys for the task results themselves (keys needed for display).
  const projectKeys = new Map(
    (await Project.find({ _id: { $in: visible.map(toId) } }).select("_id key name").lean()).map((p) => [String(p._id), p.key])
  );

  const total =
    projectRows.length + taskRows.length + commentRows.length + messageOut.length + memberRows.length;
  return {
    query: q,
    projects: projectRows.map((r) => ({
      id: String(r._id),
      name: r.name as string,
      key: projectKeys.get(String(r._id)) ?? (r.key as string),
      description: (r.description as string | null) ?? null,
    })),
    tasks: taskRows.map((r) => ({
      id: String(r._id),
      key: `${projectKeys.get(String(r.projectId)) ?? ""}-${(r.number as number | undefined) ?? "?"}`,
      title: r.title as string,
      status: r.status as string,
      priority: r.priority as string,
      projectId: String(r.projectId),
    })),
    comments: commentRows.map((r) => ({
      id: String(r._id),
      body: snippet(r.body as string),
      taskId: String(r.taskId),
      taskKey: (() => {
        const meta = taskKeyByComment.get(String(r.taskId));
        return meta ? `${projectKeys.get(meta.projectId) ?? "?"}-${meta.number}` : "?";
      })(),
      projectId: String(r.projectId),
    })),
    messages: messageOut,
    members: memberRows.map((m) => ({
      userId: String(m._id),
      name: m.name as string,
      email: m.email as string,
      avatarUrl: (m.avatarUrl as string | null) ?? null,
    })),
    total,
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
