/* ------------------------------------------------------------------ */
/* Team chat service — DMs, groups, per-project channels.              */
/* Reads verify conversation membership (server-side); project         */
/* channels inherit the project's access rules. Presence is derived    */
/* from recent session activity (lastActiveAt), no extra infra needed. */
/* ------------------------------------------------------------------ */
import { ApiError } from "@/server/errors";
import { connectDb } from "@/server/db/db";
import { Conversation } from "@/server/db/models/conversation.model";
import { Message } from "@/server/db/models/message.model";
import { ConversationRead } from "@/server/db/models/conversation-read.model";
import { Project } from "@/server/db/models/project.model";
import { ProjectMember } from "@/server/db/models/project-member.model";
import { Membership } from "@/server/db/models/membership.model";
import { User } from "@/server/db/models/user.model";
import { Session } from "@/server/db/models/session.model";
import { File } from "@/server/db/models/file.model";
import { assertOrgPermission, assertProjectPermission, resolveOrgContext } from "@/server/authorization/guard";
import { extractMentions } from "@/server/services/comment.service";
import { notify } from "@/server/services/notification.service";
import { logActivity } from "@/server/services/activity.service";
import { getUserInfos } from "@/server/db/lookups";
import { toAssignee, emptyPerson } from "@/server/serializers/task";
import { publish, userChannel, orgChannel } from "@/server/realtime/events";
import type { ConversationDTO, MessageDTO, MessageSummaryDTO, AssigneeDTO, FileMetaDTO } from "@/types";
import { serializeFile, type FileLike } from "@/server/services/file.service";
import { Types } from "mongoose";

const toId = (s: string) => new Types.ObjectId(s);

type ConvLean = {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  type: "dm" | "group" | "project_channel";
  name: string | null;
  projectId: Types.ObjectId | null;
  createdBy: Types.ObjectId;
  memberIds: Types.ObjectId[];
  dmPairKey: string | null;
  lastMessageAt: Date | null;
  createdAt: Date;
};

type MsgLean = {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  type: "text" | "system";
  body: string;
  parentId: Types.ObjectId | null;
  mentions: Types.ObjectId[];
  attachments: { fileId: string; name: string; mime: string; size: number; url: string }[];
  reactions: { emoji: string; userIds: Types.ObjectId[] }[];
  editedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
};

async function loadConv(conversationId: string): Promise<ConvLean | null> {
  const raw = (await Conversation.findById(toId(conversationId)).lean()) as unknown as ConvLean | null;
  return raw;
}

/**
 * Gate: can this user see this conversation? Returns org role for
 * moderation decisions. DMs/groups → membership in memberIds or
 * creator; channels → project permission chat.read.
 */
async function assertConversationAccess(
  actorUserId: string,
  conversationId: string
): Promise<{ organizationId: string; orgRole: string; conv: ConvLean }> {
  await connectDb();
  const conv = await loadConv(conversationId);
  if (!conv) throw ApiError.notFound("That conversation does not exist.");

  if (conv.type === "project_channel" && conv.projectId) {
    const access = await assertProjectPermission(actorUserId, String(conv.projectId), "chat.read");
    return { organizationId: access.organizationId, orgRole: access.orgRole, conv };
  }
  const ctx = await resolveOrgContext(actorUserId, String(conv.organizationId));
  const isMember = conv.memberIds.some((m) => String(m) === actorUserId);
  if (!isMember) throw ApiError.forbidden("You are not part of this conversation.");
  return { organizationId: ctx.organizationId, orgRole: ctx.role, conv };
}

function visibleFor(userId: string, memberIds: Types.ObjectId[]): boolean {
  return memberIds.some((m) => String(m) === userId);
}

async function memberInfos(ids: Types.ObjectId[], cap = 24): Promise<AssigneeDTO[]> {
  const users = await getUserInfos(ids.slice(0, cap).map((m) => String(m)));
  const out: AssigneeDTO[] = [];
  for (const id of ids.slice(0, cap)) {
    const info = users.get(String(id));
    out.push(toAssignee(info) ?? emptyPerson(String(id)));
  }
  return out;
}

async function unreadFor(userId: string, conv: ConvLean): Promise<number> {
  const read = await ConversationRead.findOne({ conversationId: conv._id, userId: toId(userId) }).lean();
  const filter: Record<string, unknown> = {
    conversationId: conv._id,
    deletedAt: null,
    senderId: { $ne: toId(userId) },
  };
  if (read) {
    const lastRead = read.lastReadAt as Date;
    filter.createdAt = { $gt: lastRead };
  }
  return Message.countDocuments(filter);
}

async function serializeConversation(conv: ConvLean, actorUserId: string, memberOverride?: AssigneeDTO[]): Promise<ConversationDTO> {
  const members = memberOverride ?? (await memberInfos(conv.memberIds));
  const last = (await Message.findOne({ conversationId: conv._id, deletedAt: null })
    .sort({ createdAt: -1 })
    .select("_id senderId body createdAt")
    .lean()) as unknown as { _id: Types.ObjectId; senderId: Types.ObjectId; body: string; createdAt: Date } | null;
  const senders = last ? await getUserInfos([String(last.senderId)]) : new Map();
  const unread = await unreadFor(actorUserId, conv);
  return {
    id: String(conv._id),
    type: conv.type,
    name:
      conv.name ??
      (conv.type === "dm"
        ? (members.find((m) => m.userId !== actorUserId)?.name ?? members[0]?.name ?? "Direct message")
        : "Group"),
    iconUrl: null,
    members,
    unreadCount: unread,
    lastMessage: last
      ? {
          id: String(last._id),
          senderName: senders.get(String(last.senderId))?.name ?? "Someone",
          senderAvatarUrl: senders.get(String(last.senderId))?.avatarUrl ?? null,
          body: last.body.slice(0, 200),
          createdAt: new Date(last.createdAt).toISOString(),
        }
      : null,
    createdAt: new Date(conv.createdAt).toISOString(),
    projectId: conv.projectId ? String(conv.projectId) : null,
  };
}

/** Reconstruct full file metadata for message embeds (files may be deleted later). */
async function attachmentMetas(attachments: MsgLean["attachments"]): Promise<FileMetaDTO[]> {
  if (!attachments.length) return [];
  const ids = attachments.map((a) => a.fileId);
  const files = (await File.find({ _id: { $in: ids } }).lean()) as unknown as FileLike[];
  const users = await getUserInfos(files.map((f) => String(f.uploaderId)));
  const byId = new Map<string, FileMetaDTO>();
  for (const f of files) {
    byId.set(String(f._id), await serializeFile(f, false, users.get(String(f.uploaderId))?.name));
  }
  return attachments.map((a) => {
    const meta = byId.get(a.fileId);
    if (meta) return { ...meta, url: meta.url || a.url };
    return {
      id: a.fileId,
      name: a.name,
      mime: a.mime,
      size: a.size,
      url: a.url,
      isImage: a.mime.startsWith("image/"),
      uploadedByName: "Attachment",
      createdAt: new Date(0).toISOString(),
      kind: "message_attachment",
      ownerType: null,
      ownerId: null,
      canDelete: false,
    };
  });
}

/** Channels visible to a user (non-private org projects they can read). */
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

async function channelMembers(projectId: string): Promise<AssigneeDTO[]> {
  const rows = (await ProjectMember.find({ projectId: toId(projectId) }).select("userId").lean()) as unknown as {
    userId: Types.ObjectId;
  }[];
  return memberInfos(rows.slice(0, 40).map((r) => r.userId));
}

/** Org chat: DMs/groups I'm in + channels for projects I can see. */
export async function listConversations(actorUserId: string, orgIdOrSlug: string): Promise<ConversationDTO[]> {
  const ctx = await resolveOrgContext(actorUserId, orgIdOrSlug);
  await connectDb();
  const [mine, projectIds] = await Promise.all([
    Conversation.find({
      organizationId: toId(ctx.organizationId),
      type: { $in: ["dm", "group"] },
      memberIds: toId(actorUserId),
    })
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .limit(200)
      .lean(),
    visibleProjectIds(actorUserId, ctx.organizationId),
  ]);
  const convs = mine as unknown as ConvLean[];
  if (projectIds.length) {
    const channels = (await Conversation.find({ organizationId: toId(ctx.organizationId), projectId: { $in: projectIds } })
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .limit(200)
      .lean()) as unknown as ConvLean[];
    convs.push(...channels);
  }
  convs.sort((a, b) => (b.lastMessageAt?.getTime() ?? b.createdAt.getTime()) - (a.lastMessageAt?.getTime() ?? a.createdAt.getTime()));

  const out: ConversationDTO[] = [];
  for (const conv of convs) {
    let override: AssigneeDTO[] | undefined;
    if (conv.type === "project_channel" && conv.projectId) {
      override = await channelMembers(String(conv.projectId));
      const project = await Project.findById(String(conv.projectId)).select("name key").lean();
      const p = project as { name: string; key: string } | null;
      if (p) conv.name = `${p.name}`;
    }
    out.push(await serializeConversation(conv, actorUserId, override));
  }
  return out;
}

function dmPairKey(a: string, b: string): string {
  return [a, b].sort().join("_");
}

export async function getOrCreateDm(actorUserId: string, orgIdOrSlug: string, peerId: string): Promise<ConversationDTO> {
  const ctx = await resolveOrgContext(actorUserId, orgIdOrSlug);
  await connectDb();
  const member = (await Membership.findOne({ organizationId: toId(ctx.organizationId), userId: toId(peerId), status: "active" }).lean()) as unknown as { _id: Types.ObjectId } | null;
  if (!member) throw ApiError.badRequest("That person is not an active member of this organization.");

  const pair = dmPairKey(actorUserId, peerId);
  let conv = (await Conversation.findOne({ organizationId: toId(ctx.organizationId), dmPairKey: pair }).lean()) as unknown as ConvLean | null;
  if (!conv) {
    conv = (await Conversation.create({
      organizationId: toId(ctx.organizationId),
      type: "dm",
      name: null,
      projectId: null,
      createdBy: toId(actorUserId),
      memberIds: [toId(actorUserId), toId(peerId)],
      dmPairKey: pair,
      lastMessageAt: null,
    }).then((d) => d.toObject())) as unknown as ConvLean;
  }
  return serializeConversation(conv, actorUserId);
}

export async function createGroup(actorUserId: string, orgIdOrSlug: string, name: string, memberIds: string[]): Promise<ConversationDTO> {
  const ctx = await resolveOrgContext(actorUserId, orgIdOrSlug);
  await connectDb();
  if (!ctx.role) throw ApiError.forbidden();
  const unique = [...new Set([actorUserId, ...memberIds])];
  const active = (await Membership.find({
    organizationId: toId(ctx.organizationId),
    userId: { $in: unique },
    status: "active",
  })
    .select("userId")
    .lean()) as unknown as { userId: Types.ObjectId }[];
  const activeIds = active.map((m) => String(m.userId));
  const invalid = unique.filter((id) => !activeIds.includes(id));
  if (invalid.length) throw ApiError.badRequest("Every group member must be an active organization member.");
  if (unique.length > 200) throw ApiError.badRequest("Groups can have up to 200 members.");

  const doc = await Conversation.create({
    organizationId: toId(ctx.organizationId),
    type: "group",
    name,
    projectId: null,
    createdBy: toId(actorUserId),
    memberIds: unique.map(toId),
    dmPairKey: null,
    lastMessageAt: null,
  });
  void logActivity({
    organizationId: ctx.organizationId,
    actorId: actorUserId,
    action: "chat.group_create",
    entityType: "conversation",
    entityId: String(doc._id),
    metadata: { name, memberCount: unique.length },
  });
  const conv = doc.toObject() as unknown as ConvLean;
  void publish(
    unique.map((u) => userChannel(u)),
    "conversation.created",
    { conversationId: String(doc._id), name }
  );
  return serializeConversation(conv, actorUserId);
}

/** Per-project channel (one per project; idempotent). */
export async function getOrCreateProjectChannel(actorUserId: string, projectId: string): Promise<ConversationDTO> {
  const access = await assertProjectPermission(actorUserId, projectId, "chat.read");
  await connectDb();
  let conv = (await Conversation.findOne({ projectId: toId(projectId) }).lean()) as unknown as ConvLean | null;
  if (!conv) {
    const doc = await Conversation.create({
      organizationId: toId(access.organizationId),
      type: "project_channel",
      name: null,
      projectId: toId(projectId),
      createdBy: toId(actorUserId),
      memberIds: [],
      dmPairKey: null,
      lastMessageAt: null,
    });
    conv = doc.toObject() as unknown as ConvLean;
  }
  const project = (await Project.findById(String(conv.projectId)).select("name key").lean()) as { name: string; key: string } | null;
  const override = await channelMembers(projectId);
  return serializeConversation({ ...conv, name: project?.name ?? "Channel" }, actorUserId, override);
}

export async function listMessages(
  actorUserId: string,
  conversationId: string,
  opts: { page?: number; pageSize?: number } = {}
): Promise<{ conversation: ConversationDTO; items: MessageDTO[]; total: number; hasMore: boolean }> {
  const { conv } = await assertConversationAccess(actorUserId, conversationId);
  const page = opts.page ?? 1;
  const pageSize = Math.min(opts.pageSize ?? 50, 100);
  const filter = { conversationId: conv._id, deletedAt: null };
  const [rows, total] = await Promise.all([
    Message.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    Message.countDocuments(filter),
  ]);
  const msgs = (rows as unknown as MsgLean[]).reverse(); // chronological
  const allIds = [
    ...new Set(msgs.flatMap((m) => [String(m.senderId), ...(m.parentId ? [String(m.parentId)] : [])])),
  ];
  const users = await getUserInfos(allIds);
  const parentIds = [...new Set(msgs.map((m) => (m.parentId ? String(m.parentId) : "")).filter(Boolean))];
  const parents = parentIds.length
    ? ((await Message.find({ _id: { $in: parentIds } }).select("_id senderId body createdAt").lean()) as unknown as MsgLean[])
    : [];

  const orgRole = await resolveOrgRoleFor(actorUserId, String(conv.organizationId));
  const isAdmin = orgRole === "owner" || orgRole === "admin";
  const convInfo = await serializeConversation(
    conv.type === "project_channel" && conv.projectId
      ? { ...conv, name: conv.name ?? "Channel" }
      : conv,
    actorUserId,
    conv.type === "project_channel" && conv.projectId ? await channelMembers(String(conv.projectId)) : undefined
  );

  const attachMap = new Map<string, FileMetaDTO[]>();
  for (const m of msgs) attachMap.set(String(m._id), await attachmentMetas(m.attachments));

  const items: MessageDTO[] = msgs.map((m) => {
    const parent = m.parentId ? parents.find((p) => String(p._id) === String(m.parentId)) ?? null : null;
    const sender = users.get(String(m.senderId));
    return {
      id: String(m._id),
      conversationId,
      sender: toAssignee(sender) ?? emptyPerson(String(m.senderId)),
      body: m.body,
      type: m.type,
      parent: parent
        ? {
            id: String(parent._id),
            senderName: users.get(String(parent.senderId))?.name ?? "Someone",
            senderAvatarUrl: users.get(String(parent.senderId))?.avatarUrl ?? null,
            body: parent.body.slice(0, 200) || "[deleted]",
            createdAt: new Date(parent.createdAt).toISOString(),
          }
        : null,
      reactions: m.reactions.map((r) => ({
        emoji: r.emoji,
        count: r.userIds.length,
        reactedByMe: r.userIds.some((u) => String(u) === actorUserId),
      })),
      mentions: m.mentions.map((x) => String(x)),
      attachments: attachMap.get(String(m._id)) ?? [],
      editedAt: m.editedAt ? new Date(m.editedAt).toISOString() : null,
      createdAt: new Date(m.createdAt).toISOString(),
      canEdit: String(m.senderId) === actorUserId,
      canDelete: String(m.senderId) === actorUserId || isAdmin,
    };
  });
  return { conversation: convInfo, items, total, hasMore: page * pageSize < total };
}

async function resolveOrgRoleFor(actorUserId: string, organizationId: string): Promise<string> {
  const ctx = await resolveOrgContext(actorUserId, organizationId).catch(() => null);
  return ctx?.role ?? "guest";
}

async function serializeSingleMessage(
  m: MsgLean,
  actorUserId: string,
  conversationId: string,
  users?: Map<string, { id: string; name: string; email: string; avatarUrl: string | null }>,
  isAdmin = false
): Promise<MessageDTO> {
  const userMap = users ?? (await getUserInfos([String(m.senderId)]));
  return {
    id: String(m._id),
    conversationId,
    sender: toAssignee(userMap.get(String(m.senderId))) ?? emptyPerson(String(m.senderId)),
    body: m.body,
    type: m.type,
    parent: null,
    reactions: m.reactions.map((r) => ({
      emoji: r.emoji,
      count: r.userIds.length,
      reactedByMe: r.userIds.some((u) => String(u) === actorUserId),
    })),
    mentions: m.mentions.map((x) => String(x)),
    attachments: await attachmentMetas(m.attachments),
    editedAt: m.editedAt ? new Date(m.editedAt).toISOString() : null,
    createdAt: new Date(m.createdAt).toISOString(),
    canEdit: String(m.senderId) === actorUserId,
    canDelete: String(m.senderId) === actorUserId || isAdmin,
  };
}

/** Sends a message; mentions trigger chat notifications. */
export async function sendMessage(
  actorUserId: string,
  conversationId: string,
  input: { body: string; parentId?: string | null; attachmentFileIds?: string[] }
): Promise<MessageDTO> {
  const { organizationId, conv } = await assertConversationAccess(actorUserId, conversationId);
  await connectDb();

  const parentId = input.parentId ? toId(input.parentId) : null;
  if (parentId) {
    const parent = await Message.exists({ _id: parentId, conversationId: conv._id });
    if (!parent) throw ApiError.badRequest("The message you are replying to was not found.");
  }

  // Attachments: must be org-owned message_attachment files for this conversation.
  const attachments: { fileId: string; name: string; mime: string; size: number; url: string }[] = [];
  if (input.attachmentFileIds?.length) {
    const files = (await File.find({ _id: { $in: input.attachmentFileIds.map(toId) } }).lean()) as unknown as {
      _id: Types.ObjectId;
      organizationId: Types.ObjectId;
      ownerType: string | null;
      ownerId: Types.ObjectId | null;
      name: string;
      mime: string;
      size: number;
    }[];
    for (const f of files) {
      if (
        String(f.organizationId) !== organizationId ||
        f.ownerType !== "conversation" ||
        !f.ownerId ||
        String(f.ownerId) !== conversationId
      ) {
        throw ApiError.badRequest("One of the attachments does not belong to this conversation.");
      }
      attachments.push({
        fileId: String(f._id),
        name: f.name,
        mime: f.mime,
        size: f.size,
        url: `/api/files/${String(f._id)}/content`,
      });
    }
    if (attachments.length !== input.attachmentFileIds.length) {
      throw ApiError.badRequest("One of the attachments no longer exists.");
    }
  }

  const mentionsRaw = extractMentions(input.body);
  const mentions = (
    (await Membership.find({
      organizationId: toId(organizationId),
      userId: { $in: mentionsRaw },
      status: "active",
    })
      .select("userId")
      .lean()) as unknown as { userId: Types.ObjectId }[]
  ).map((m) => String(m.userId));

  const doc = await Message.create({
    organizationId: toId(organizationId),
    conversationId: conv._id,
    senderId: toId(actorUserId),
    type: "text",
    body: input.body,
    parentId,
    mentions: mentions.map(toId),
    attachments,
    reactions: [],
    editedAt: null,
    deletedAt: null,
  });
  await Conversation.updateOne({ _id: conv._id }, { $set: { lastMessageAt: new Date() } });

  const recipients = conv.type === "dm" || conv.type === "group" ? conv.memberIds.map((m) => String(m)) : [];
  void notify({
    organizationId,
    type: "chat_message",
    title: "New message",
    body: input.body.slice(0, 160),
    actorId: actorUserId,
    recipientIds: [...new Set([...mentions, ...recipients])],
    entity: { type: "conversation", id: conversationId },
    link: "/chat/" + conversationId,
  });
  void logActivity({
    organizationId,
    actorId: actorUserId,
    action: "chat.message",
    entityType: "conversation",
    entityId: conversationId,
    metadata: { hasMentions: mentions.length > 0 },
  });
  void publish(
    [orgChannel(organizationId), ...conv.memberIds.map((m) => userChannel(String(m)))],
    "message.created",
    { conversationId, message: await serializeSingleMessage(doc.toObject() as unknown as MsgLean, actorUserId, conversationId) }
  );
  return serializeSingleMessage(doc.toObject() as unknown as MsgLean, actorUserId, conversationId);
}

export async function updateMessage(actorUserId: string, messageId: string, body: string): Promise<MessageDTO> {
  const msg = (await Message.findOne({ _id: toId(messageId), deletedAt: null }).lean()) as unknown as MsgLean | null;
  if (!msg) throw ApiError.notFound("Message not found.");
  const { organizationId } = await assertConversationAccess(actorUserId, String(msg.conversationId));
  if (String(msg.senderId) !== actorUserId) throw ApiError.forbidden("Only the author can edit a message.");

  const doc = await Message.findByIdAndUpdate(
    msg._id,
    { $set: { body, editedAt: new Date() } },
    { new: true }
  );
  if (!doc) throw ApiError.notFound("Message not found.");
  const m = doc.toObject() as unknown as MsgLean;
  void publish([orgChannel(organizationId), ...(await convChannels(String(msg.conversationId)))], "message.updated", {
    conversationId: String(msg.conversationId),
    messageId: String(msg._id),
    body: m.body,
    editedAt: m.editedAt,
  });
  return serializeSingleMessage(m, actorUserId, String(msg.conversationId));
}

async function convChannels(conversationId: string): Promise<string[]> {
  const conv = await loadConv(conversationId);
  return conv ? conv.memberIds.map((m) => userChannel(String(m))) : [];
}

export async function deleteMessage(actorUserId: string, messageId: string): Promise<void> {
  const msg = (await Message.findOne({ _id: toId(messageId), deletedAt: null }).lean()) as unknown as MsgLean | null;
  if (!msg) throw ApiError.notFound("Message not found.");
  const { organizationId, orgRole } = await assertConversationAccess(actorUserId, String(msg.conversationId));
  const isAdmin = orgRole === "owner" || orgRole === "admin";
  if (String(msg.senderId) !== actorUserId && !isAdmin) throw ApiError.forbidden("Only the author or an organization admin can delete this message.");

  await Message.updateOne({ _id: msg._id }, { $set: { deletedAt: new Date(), body: "" } });
  void publish([orgChannel(organizationId), ...(await convChannels(String(msg.conversationId)))], "message.deleted", {
    conversationId: String(msg.conversationId),
    messageId: String(msg._id),
  });
}

export async function toggleReaction(actorUserId: string, messageId: string, emoji: string): Promise<{ emoji: string; count: number; reactedByMe: boolean }> {
  const msg = (await Message.findOne({ _id: toId(messageId), deletedAt: null }).lean()) as unknown as MsgLean | null;
  if (!msg) throw ApiError.notFound("Message not found.");
  const { organizationId } = await assertConversationAccess(actorUserId, String(msg.conversationId));
  const doc = await Message.findById(msg._id);
  if (!doc) throw ApiError.notFound("Message not found.");
  const existing = doc.reactions.find((r) => r.emoji === emoji);
  let reacted = false;
  if (existing) {
    const idx = existing.userIds.findIndex((u) => String(u) === actorUserId);
    if (idx >= 0) {
      existing.userIds.splice(idx, 1);
      if (!existing.userIds.length) doc.reactions = doc.reactions.filter((r) => r.emoji !== emoji);
    } else {
      existing.userIds.push(toId(actorUserId) as never);
      reacted = true;
    }
  } else {
    doc.reactions.push({ emoji, userIds: [toId(actorUserId) as never] });
    reacted = true;
  }
  await doc.save();
  const result = doc.reactions.find((r) => r.emoji === emoji);
  void publish([orgChannel(organizationId), ...(await convChannels(String(msg.conversationId)))], "message.updated", {
    conversationId: String(msg.conversationId),
    messageId: String(msg._id),
  });
  return { emoji, count: result?.userIds.length ?? 0, reactedByMe: reacted };
}

export async function markConversationRead(actorUserId: string, conversationId: string): Promise<void> {
  await assertConversationAccess(actorUserId, conversationId);
  await connectDb();
  await ConversationRead.updateOne(
    { conversationId: toId(conversationId), userId: toId(actorUserId) },
    { $set: { lastReadAt: new Date() } },
    { upsert: true }
  );
}

/** Typing indicator — throttled by the client; just fans out. */
export async function broadcastTyping(actorUserId: string, conversationId: string): Promise<void> {
  const { organizationId, conv } = await assertConversationAccess(actorUserId, conversationId);
  const users = await getUserInfos([actorUserId]);
  const me = toAssignee(users.get(actorUserId)) ?? emptyPerson(actorUserId);
  await publish(
    [orgChannel(organizationId), ...conv.memberIds.filter((m) => String(m) !== actorUserId).map((m) => userChannel(String(m)))],
    "typing",
    { conversationId, user: me }
  );
}

/** Presence: org members with an active session in the last 2 minutes. */
export async function onlineMembers(actorUserId: string, orgIdOrSlug: string): Promise<AssigneeDTO[]> {
  const ctx = await resolveOrgContext(actorUserId, orgIdOrSlug);
  await connectDb();
  const since = new Date(Date.now() - 2 * 60 * 1000);
  const activeSessions = await Session.find({
    lastActiveAt: { $gte: since },
    expiresAt: { $gt: new Date() },
    revokedAt: null,
  })
    .distinct("userId")
    .exec();
  const userIds = activeSessions.map((u) => String(u));
  if (!userIds.length) return [];
  const members = (await Membership.find({ organizationId: toId(ctx.organizationId), userId: { $in: userIds }, status: "active" })
    .select("userId")
    .lean()) as unknown as { userId: Types.ObjectId }[];
  const ids = members.map((m) => String(m.userId));
  const users = await getUserInfos(ids);
  return ids
    .map((id) => toAssignee(users.get(id)) ?? emptyPerson(id))
    .sort((a, b) => a.name.localeCompare(b.name));
}
