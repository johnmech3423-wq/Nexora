import { connectDb } from "@/server/db/db";
import { TaskComment } from "@/server/db/models/task-comment.model";
import { Task } from "@/server/db/models/task.model";
import { Project } from "@/server/db/models/project.model";
import { ProjectMember } from "@/server/db/models/project-member.model";
import { Membership } from "@/server/db/models/membership.model";
import { ApiError } from "@/server/errors";
import { assertProjectPermission } from "@/server/authorization/guard";
import { logActivity } from "@/server/services/activity.service";
import { dispatchWebhookEvent } from "@/server/services/webhook.service";

import { notify } from "@/server/services/notification.service";
import { publish, orgChannel } from "@/server/realtime/events";
import { getUserInfos } from "@/server/db/lookups";
import { serializeComment } from "@/server/serializers/task";
import type { CommentDTO } from "@/types";

const PAGE_SIZE = 25;

async function loadTask(projectId: string, taskId: string): Promise<InstanceType<typeof Task>> {
  const task = await Task.findOne({ _id: taskId, projectId, deletedAt: null });
  if (!task) throw ApiError.notFound("That task no longer exists.");
  return task;
}

/** Parse @[Name](userId) mentions → validated userIds. */
export function extractMentions(body: string): string[] {
  const ids: string[] = [];
  const re = /@\[([^\]]+)\]\(([a-f0-9]{24})\)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) ids.push(m[2]!);
  return [...new Set(ids)];
}

/** Reject mentions of people who can't see this project. */
async function validateMentions(organizationId: string, mentions: string[]): Promise<string[]> {
  if (mentions.length === 0) return [];
  const members = await Membership.find({ organizationId, userId: { $in: mentions }, status: "active" })
    .select("userId")
    .lean();
  return members.map((m) => String(m.userId));
}

export async function listComments(
  actorUserId: string,
  projectId: string,
  taskId: string,
  page = 1
): Promise<{ items: CommentDTO[]; total: number; hasMore: boolean }> {
  await connectDb();
  await assertProjectPermission(actorUserId, projectId, "task.read");
  await loadTask(projectId, taskId);

  const [docs, total] = await Promise.all([
    TaskComment.find({ taskId, deletedAt: null })
      .sort({ createdAt: 1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
    TaskComment.countDocuments({ taskId, deletedAt: null }),
  ]);

  const [users, canModerate, replies] = await Promise.all([
    getUserInfos([actorUserId, ...docs.map((c) => String(c.authorId))]),
    userCanModerate(actorUserId, projectId),
    docs.length
      ? TaskComment.find({ taskId, parentId: { $in: docs.map((c) => c._id) }, deletedAt: null })
          .select("_id parentId")
          .lean()
      : [],
  ]);
  const replyCounts = new Map<string, number>();
  for (const r of replies) replyCounts.set(String(r.parentId), (replyCounts.get(String(r.parentId)) ?? 0) + 1);

  return {
    items: docs.map((c) =>
      serializeComment(
        {
          _id: c._id,
          taskId: c.taskId,
          parentId: c.parentId,
          authorId: c.authorId,
          body: c.body,
          mentions: c.mentions,
          reactions: c.reactions,
          editedAt: c.editedAt,
          createdAt: c.createdAt,
        },
        users,
        actorUserId,
        replyCounts.get(String(c._id)) ?? 0,
        canModerate
      )
    ),
    total,
    hasMore: page * PAGE_SIZE < total,
  };
}

async function userCanModerate(actorUserId: string, projectId: string): Promise<boolean> {
  const project = await Project.findById(projectId).select("organizationId").lean();
  const membership = await ProjectMember.findOne({ projectId, userId: actorUserId }).select("role").lean();
  if (membership?.role === "manager") return true;
  if (!project) return false;
  const orgRole = await Membership.findOne({ organizationId: project.organizationId, userId: actorUserId }).select("role").lean();
  return orgRole?.role === "owner" || orgRole?.role === "admin";
}

export async function addComment(
  actorUserId: string,
  projectId: string,
  taskId: string,
  input: { body: string; parentId?: string | null }
): Promise<CommentDTO> {
  await connectDb();
  await assertProjectPermission(actorUserId, projectId, "task.comment");
  const task = await loadTask(projectId, taskId);
  const project = await Project.findById(projectId).select("organizationId name").lean();
  if (!project) throw ApiError.notFound();

  let parentDoc = null;
  if (input.parentId) {
    parentDoc = await TaskComment.findOne({ _id: input.parentId, taskId, deletedAt: null });
    if (!parentDoc) throw ApiError.badRequest("The comment you're replying to no longer exists.");
  }

  const rawMentions = extractMentions(input.body);
  const mentions = await validateMentions(String(project.organizationId), rawMentions);

  const comment = await TaskComment.create({
    taskId,
    projectId,
    organizationId: project.organizationId,
    parentId: input.parentId ?? null,
    authorId: actorUserId,
    body: input.body,
    mentions,
  });

  // Notifications: mentions → mention; everyone watching → comment.
  const watchers = (task.watchers ?? []).map(String);
  const assignee = task.assigneeId ? [String(task.assigneeId)] : [];
  const taskLink = taskUrl(project.organizationId.toString(), projectId, taskId);
  if (mentions.length > 0) {
    void notify({
      organizationId: String(project.organizationId),
      type: "mention",
      actorId: actorUserId,
      recipientIds: mentions,
      title: `${(await getUserInfos([actorUserId])).get(actorUserId)?.name ?? "Someone"} mentioned you in ${project.name}`,
      entity: { type: "comment", id: String(comment._id), projectId },
      link: taskLink,
    });
  }
  const commentWatchers = watchers.filter((w) => !mentions.includes(w));
  if (commentWatchers.length > 0) {
    void notify({
      organizationId: String(project.organizationId),
      type: "comment",
      actorId: actorUserId,
      recipientIds: [...new Set([...commentWatchers, ...assignee])],
      title: `New comment on ${project.name}`,
      body: input.body.slice(0, 200),
      entity: { type: "comment", id: String(comment._id), projectId },
      link: taskLink,
    });
  }

  void logActivity({
    organizationId: String(project.organizationId),
    action: "comment.create",
    actorId: actorUserId,
    entityType: "comment",
    entityId: String(comment._id),
    projectId,
    metadata: { taskId },
  });
  void publish([orgChannel(String(project.organizationId))], "comment.created", {
    id: String(comment._id),
    taskId,
    projectId,
    parentId: input.parentId ?? null,
  });
  void dispatchWebhookEvent(String(project.organizationId), "comment.created", {
    id: String(comment._id),
    taskId,
    projectId,
    parentId: input.parentId ?? null,
    authorId: actorUserId,
  });

  const users = await getUserInfos([actorUserId]);
  return serializeComment(
    {
      _id: comment._id,
      taskId: comment.taskId,
      parentId: comment.parentId,
      authorId: comment.authorId,
      body: comment.body,
      mentions: comment.mentions,
      reactions: [],
      editedAt: null,
      createdAt: comment.createdAt,
    },
    users,
    actorUserId,
    0,
    false
  );
}

function taskUrl(organizationId: string, projectId: string, taskId: string): string {
  void organizationId;
  return `/projects/${projectId}/tasks/${taskId}`;
}

export async function updateComment(
  actorUserId: string,
  projectId: string,
  commentId: string,
  body: string
): Promise<CommentDTO> {
  await connectDb();
  const comment = await TaskComment.findOne({ _id: commentId, projectId });
  if (!comment || comment.deletedAt) throw ApiError.notFound("That comment no longer exists.");
  if (String(comment.authorId) !== actorUserId) throw ApiError.forbidden("Only the author can edit a comment.");

  const mentions = await validateMentions(String(comment.organizationId), extractMentions(body));
  comment.body = body;
  comment.mentions = mentions as unknown as typeof comment.mentions;
  comment.editedAt = new Date();
  await comment.save();

  const project = await Project.findById(projectId).select("organizationId").lean();
  void publish([orgChannel(String(comment.organizationId))], "comment.updated", { id: commentId, projectId });
  void logActivity({
    organizationId: String(comment.organizationId),
    action: "comment.update",
    actorId: actorUserId,
    entityType: "comment",
    entityId: commentId,
    projectId,
  });
  void project;
  const users = await getUserInfos([actorUserId, String(comment.authorId)]);
  return serializeComment(
    {
      _id: comment._id,
      taskId: comment.taskId,
      parentId: comment.parentId,
      authorId: comment.authorId,
      body: comment.body,
      mentions: comment.mentions,
      reactions: comment.reactions,
      editedAt: comment.editedAt,
      createdAt: comment.createdAt,
    },
    users,
    actorUserId,
    0,
    false
  );
}

export async function deleteComment(actorUserId: string, projectId: string, commentId: string): Promise<void> {
  await connectDb();
  const comment = await TaskComment.findOne({ _id: commentId, projectId });
  if (!comment || comment.deletedAt) throw ApiError.notFound("That comment no longer exists.");
  const isAuthor = String(comment.authorId) === actorUserId;
  if (!isAuthor) {
    await assertProjectPermission(actorUserId, projectId, "comment.delete");
  }
  comment.deletedAt = new Date();
  await comment.save();
  await TaskComment.updateMany({ parentId: comment._id }, { $set: { deletedAt: new Date() } });
  void publish([orgChannel(String(comment.organizationId))], "comment.deleted", { id: commentId, projectId });
  void logActivity({
    organizationId: String(comment.organizationId),
    action: "comment.delete",
    actorId: actorUserId,
    entityType: "comment",
    entityId: commentId,
    projectId,
  });
}

export async function toggleCommentReaction(
  actorUserId: string,
  projectId: string,
  commentId: string,
  emoji: string
): Promise<{ emoji: string; count: number; reactedByMe: boolean }> {
  await connectDb();
  const comment = await TaskComment.findOne({ _id: commentId, projectId });
  if (!comment || comment.deletedAt) throw ApiError.notFound("That comment no longer exists.");
  await assertProjectPermission(actorUserId, projectId, "task.read");

  const existing = comment.reactions.find((r) => r.emoji === emoji);
  const userId = actorUserId as unknown as typeof comment.reactions[number]["userIds"][number];
  if (existing) {
    const idx = existing.userIds.findIndex((u) => String(u) === actorUserId);
    if (idx >= 0) {
      existing.userIds.splice(idx, 1);
      if (existing.userIds.length === 0) {
        comment.reactions = comment.reactions.filter((r) => r.emoji !== emoji);
      }
    } else {
      existing.userIds.push(userId);
    }
  } else {
    comment.reactions.push({ emoji, userIds: [userId] });
  }
  await comment.save();

  const reaction = comment.reactions.find((r) => r.emoji === emoji);
  return {
    emoji,
    count: reaction?.userIds.length ?? 0,
    reactedByMe: Boolean(reaction?.userIds.some((u) => String(u) === actorUserId)),
  };
}
