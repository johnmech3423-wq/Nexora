/* ------------------------------------------------------------------ */
/* File service — validation, storage drivers, per-kind authorization. */
/* Kinds: avatar | task_attachment | comment_attachment | project_file |
/*        message_attachment                                           */
/* Every upload enforces: size cap, MIME allow-list, plan storage      */
/* quota, and a server-side permission check matching the owner scope. */
/* ------------------------------------------------------------------ */
import crypto from "node:crypto";
import { ApiError } from "@/server/errors";
import { connectDb } from "@/server/db/db";
import { File } from "@/server/db/models/file.model";
import { Organization } from "@/server/db/models/organization.model";
import { Project } from "@/server/db/models/project.model";
import { Task } from "@/server/db/models/task.model";
import { TaskComment } from "@/server/db/models/task-comment.model";
import { Conversation } from "@/server/db/models/conversation.model";
import { resolveOrgContext } from "@/server/authorization/context";
import { assertProjectPermission } from "@/server/authorization/guard";
import { putBytes, deleteObject, sniffMime, type StoredObject } from "@/server/storage";
import { logActivity } from "@/server/services/activity.service";
import { getUserInfos } from "@/server/db/lookups";
import type { FileMetaDTO } from "@/types";
import { ALLOWED_MIME_PREFIXES, IMAGE_MIME_TYPES, MAX_FILE_BYTES, PLAN_LIMITS, type FileKind } from "@/lib/constants";
import { Types } from "mongoose";

const toId = (s: string) => new Types.ObjectId(s);

/** Minimal structural shape of a File doc (lean-safe across mongoose versions). */
export interface FileLike {
  _id: unknown;
  organizationId: unknown;
  projectId: unknown;
  uploaderId: unknown;
  name: string;
  mime: string;
  size: number;
  storageProvider: "local" | "cloudinary";
  storageKey: string;
  url: string | null;
  isImage: boolean;
  width: number | null;
  height: number | null;
  createdAt: Date;
  kind: string;
  ownerType: string | null;
  ownerId: unknown;
}

export interface UploadInput {
  kind: FileKind;
  fileName: string;
  mime: string;
  bytes: Buffer;
  /** Org scope for avatars/org-level uploads (avatar = profile picture within an org). */
  organizationId?: string;
  projectId?: string;
  taskId?: string;
  commentId?: string;
  conversationId?: string;
}

/** Org-scoped quota check; increments usage on success. */
async function consumeStorageQuota(organizationId: string, additionalBytes: number): Promise<void> {
  const org = await Organization.findById(toId(organizationId)).select("plan storageUsedBytes").lean();
  if (!org) throw ApiError.notFound("Organization not found.");
  const limitMb = PLAN_LIMITS[org.plan.key].storageMb;
  const used = (org.storageUsedBytes ?? 0) + additionalBytes;
  if (limitMb !== null && used > limitMb * 1024 * 1024) {
    throw new ApiError({
      status: 402,
      code: "plan_required",
      message: `Your plan's ${limitMb} MB storage limit would be exceeded. Upgrade to store more files.`,
      expose: true,
    });
  }
  await Organization.updateOne({ _id: org._id }, { $inc: { storageUsedBytes: additionalBytes } });
}

function releaseStorageQuota(organizationId: string, size: number): Promise<unknown> {
  return Organization.updateOne({ _id: toId(organizationId) }, { $inc: { storageUsedBytes: -size } }).exec();
}

export function contentUrl(fileId: unknown, provider: string, storedUrl: string | null): string {
  return provider === "cloudinary" && storedUrl ? storedUrl : `/api/files/${String(fileId)}/content`;
}

export async function serializeFile(doc: FileLike, canDelete: boolean, uploaderName?: string): Promise<FileMetaDTO> {
  const uploaderId = String(doc.uploaderId);
  const url = contentUrl(doc._id, doc.storageProvider, doc.url);
  return {
    id: String(doc._id),
    name: doc.name,
    mime: doc.mime,
    size: doc.size,
    url,
    isImage: doc.isImage,
    width: doc.width ?? undefined,
    height: doc.height ?? undefined,
    uploadedByName: uploaderName ?? "Unknown",
    createdAt: new Date(doc.createdAt).toISOString(),
    kind: doc.kind as FileKind,
    ownerType: doc.ownerType,
    ownerId: doc.ownerId ? String(doc.ownerId) : null,
    canDelete,
  };
}

/** Upload + persist. Returns the file record (used by tasks, comments, chat…). */
export async function uploadFile(actorUserId: string, input: UploadInput): Promise<FileMetaDTO> {
  await connectDb();
  if (input.bytes.length === 0) throw ApiError.badRequest("The file is empty.");
  if (input.bytes.length > MAX_FILE_BYTES) {
    throw ApiError.badRequest("Files may be up to 10 MB. Please choose a smaller file.");
  }
  const mime = input.mime.toLowerCase();
  const mimeAllowed = ALLOWED_MIME_PREFIXES.some((p) => mime.startsWith(p)) || IMAGE_MIME_TYPES.includes(mime);
  if (!mimeAllowed) throw ApiError.badRequest("That file type is not allowed.");

  const fileName = input.fileName.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 255);
  if (!fileName) throw ApiError.badRequest("File name is invalid.");

  let organizationId: string;
  let projectId: string | null = null;
  let ownerType: string | null = null;
  let ownerId: string | null = null;

  switch (input.kind) {
    case "avatar": {
      if (!input.organizationId) throw ApiError.badRequest("organizationId is required for avatar uploads.");
      await resolveOrgContext(actorUserId, input.organizationId);
      organizationId = input.organizationId;
      ownerType = "user";
      ownerId = actorUserId;
      break;
    }
    case "task_attachment": {
      if (!input.taskId) throw ApiError.badRequest("taskId is required for task attachments.");
      const task = (await Task.findOne({ _id: toId(input.taskId), deletedAt: null })
        .select("_id organizationId projectId")
        .lean()) as unknown as { _id: Types.ObjectId; organizationId: Types.ObjectId; projectId: Types.ObjectId } | null;
      if (!task) throw ApiError.notFound("That task does not exist.");
      await assertProjectPermission(actorUserId, String(task.projectId), "task.attach");
      organizationId = String(task.organizationId);
      projectId = String(task.projectId);
      ownerType = "task";
      ownerId = String(task._id);
      break;
    }
    case "comment_attachment": {
      if (!input.commentId) throw ApiError.badRequest("commentId is required for comment attachments.");
      const comment = (await TaskComment.findOne({ _id: toId(input.commentId), deletedAt: null })
        .select("_id organizationId projectId")
        .lean()) as unknown as { _id: Types.ObjectId; organizationId: Types.ObjectId; projectId: Types.ObjectId } | null;
      if (!comment) throw ApiError.notFound("That comment does not exist.");
      await assertProjectPermission(actorUserId, String(comment.projectId), "task.comment");
      organizationId = String(comment.organizationId);
      projectId = String(comment.projectId);
      ownerType = "comment";
      ownerId = String(comment._id);
      break;
    }
    case "project_file": {
      if (!input.projectId) throw ApiError.badRequest("projectId is required for project files.");
      await assertProjectPermission(actorUserId, input.projectId, "file.upload");
      const project = (await Project.findById(toId(input.projectId))
        .select("organizationId")
        .lean()) as unknown as { organizationId: Types.ObjectId } | null;
      if (!project) throw ApiError.notFound("That project does not exist.");
      organizationId = String(project.organizationId);
      projectId = input.projectId;
      ownerType = "project";
      ownerId = input.projectId;
      break;
    }
    case "message_attachment": {
      if (!input.conversationId) throw ApiError.badRequest("conversationId is required for message attachments.");
      const conv = (await Conversation.findById(toId(input.conversationId))
        .select("organizationId type memberIds projectId createdBy")
        .lean()) as unknown as {
        _id: Types.ObjectId;
        organizationId: Types.ObjectId;
        type: string;
        memberIds: Types.ObjectId[];
        projectId: Types.ObjectId | null;
        createdBy: Types.ObjectId;
      } | null;
      if (!conv) throw ApiError.notFound("That conversation does not exist.");
      const inMembers = conv.memberIds.some((m) => String(m) === actorUserId);
      if (conv.type === "project_channel" && conv.projectId) {
        await assertProjectPermission(actorUserId, String(conv.projectId), "chat.send");
      } else if (!inMembers && String(conv.createdBy) !== actorUserId) {
        throw ApiError.forbidden();
      }
      organizationId = String(conv.organizationId);
      projectId = conv.projectId ? String(conv.projectId) : null;
      ownerType = "conversation";
      ownerId = String(conv._id);
      break;
    }
    default:
      throw ApiError.badRequest("Unsupported upload kind.");
  }

  // MIME sniffing: declared type must match content magic for images/PDF.
  const sniffed = sniffMime(input.bytes);
  if (sniffed && (IMAGE_MIME_TYPES.includes(mime) || mime === "application/pdf")) {
    if (sniffed !== mime) {
      throw ApiError.badRequest(`File content looks like ${sniffed}, not ${mime}.`);
    }
  }

  const sha256 = crypto.createHash("sha256").update(input.bytes).digest("hex");
  const isImage = IMAGE_MIME_TYPES.includes(mime);

  if (organizationId) {
    await consumeStorageQuota(organizationId, input.bytes.length);
  }
  const object: StoredObject = await putBytes({
    bytes: input.bytes,
    fileName,
    mime,
    organizationId: organizationId || "profile",
  }).catch(async (error) => {
    if (organizationId) releaseStorageQuota(organizationId, input.bytes.length).catch(() => undefined);
    throw error;
  });

  let doc: { toObject: () => FileLike };
  try {
    doc = await File.create({
      organizationId: organizationId || null,
      projectId,
      kind: input.kind,
      ownerType,
      ownerId,
      uploaderId: toId(actorUserId),
      name: fileName,
      mime,
      size: input.bytes.length,
      storageProvider: object.provider,
      storageKey: object.storageKey,
      url: object.url,
      sha256,
      isImage,
    });
  } catch (error) {
    await deleteObject(object).catch(() => undefined);
    if (organizationId) releaseStorageQuota(organizationId, input.bytes.length).catch(() => undefined);
    throw error;
  }

  if (organizationId) {
    void logActivity({
      organizationId,
      actorId: actorUserId,
      action: "file.upload",
      entityType: ownerType ?? "org",
      entityId: ownerId ?? undefined,
      projectId,
      metadata: { fileName, size: input.bytes.length, kind: input.kind },
    });
  }
  return serializeFile(doc.toObject(), true);
}

export async function listFiles(
  actorUserId: string,
  orgIdOrSlug: string,
  filters: { projectId?: string; ownerType?: string; ownerId?: string; kind?: string; page?: number; pageSize?: number } = {}
): Promise<{ items: FileMetaDTO[]; total: number; hasMore: boolean }> {
  const page = filters.page ?? 1;
  const pageSize = Math.min(filters.pageSize ?? 30, 100);
  const match: Record<string, unknown> = {};
  let viewerIsAdmin = false;

  if (filters.projectId) {
    const access = await assertProjectPermission(actorUserId, filters.projectId, "task.read");
    viewerIsAdmin = access.orgRole === "owner" || access.orgRole === "admin";
    match.projectId = toId(filters.projectId);
  } else {
    const ctx = await resolveOrgContext(actorUserId, orgIdOrSlug);
    viewerIsAdmin = ctx.role === "owner" || ctx.role === "admin";
    match.organizationId = toId(orgIdOrSlug);
  }
  if (filters.ownerType) match.ownerType = filters.ownerType;
  if (filters.ownerId) match.ownerId = toId(filters.ownerId);
  if (filters.kind) match.kind = filters.kind;

  const [docs, total] = await Promise.all([
    File.find(match).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    File.countDocuments(match),
  ]);
  const uploaderIds = [...new Set(docs.map((d) => String(d.uploaderId)))];
  const names = await getUserInfos(uploaderIds);
  const items = await Promise.all(
    (docs as unknown as FileLike[]).map((d) =>
      serializeFile(d, viewerIsAdmin || String(d.uploaderId) === actorUserId, names.get(String(d.uploaderId))?.name)
    )
  );
  return { items, total, hasMore: page * pageSize < total };
}

export async function getFileMeta(actorUserId: string, fileId: string): Promise<FileMetaDTO> {
  await connectDb();
  const doc = (await File.findById(toId(fileId)).lean()) as unknown as FileLike | null;
  if (!doc) throw ApiError.notFound("File not found.");
  await assertFileAccess(actorUserId, doc);
  let isAdmin = false;
  if (doc.organizationId) {
    const ctx = await resolveOrgContext(actorUserId, String(doc.organizationId));
    isAdmin = ctx.role === "owner" || ctx.role === "admin";
  }
  return serializeFile(doc, isAdmin || String(doc.uploaderId) === actorUserId);
}

export async function assertFileAccess(actorUserId: string, doc: FileLike): Promise<void> {
  if (!doc.organizationId) {
    if (String(doc.uploaderId) === actorUserId) return;
    throw ApiError.forbidden();
  }
  await resolveOrgContext(actorUserId, String(doc.organizationId));
}

export async function resolveFileForContent(fileId: string): Promise<FileLike | null> {
  await connectDb();
  const doc = (await File.findById(toId(fileId)).lean()) as unknown as FileLike | null;
  return doc;
}

export async function deleteFile(actorUserId: string, fileId: string): Promise<void> {
  await connectDb();
  const doc = (await File.findById(toId(fileId)).lean()) as unknown as FileLike | null;
  if (!doc) throw ApiError.notFound("File not found.");
  const isUploader = String(doc.uploaderId) === actorUserId;
  let isAdmin = false;
  if (doc.organizationId) {
    const ctx = await resolveOrgContext(actorUserId, String(doc.organizationId));
    isAdmin = ctx.role === "owner" || ctx.role === "admin";
  } else if (!isUploader) {
    throw ApiError.forbidden();
  }
  if (!isUploader && !isAdmin) throw ApiError.forbidden("Only the uploader or an organization admin can delete this file.");

  await File.deleteOne({ _id: toId(fileId) });
  await deleteObject({ provider: doc.storageProvider, storageKey: doc.storageKey, url: doc.url });
  if (doc.organizationId) {
    releaseStorageQuota(String(doc.organizationId), doc.size).catch(() => undefined);
    void logActivity({
      organizationId: String(doc.organizationId),
      actorId: actorUserId,
      action: "file.delete",
      entityType: doc.ownerType,
      entityId: doc.ownerId ? String(doc.ownerId) : undefined,
      projectId: doc.projectId ? String(doc.projectId) : undefined,
      metadata: { fileName: doc.name, size: doc.size },
    });
  }
}
