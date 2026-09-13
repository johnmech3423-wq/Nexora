import type { NextRequest } from "next/server";
import { handleApi, ok } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { listFiles, uploadFile } from "@/server/services/file.service";
import { parsePositiveInt } from "@/lib/utils";

export const runtime = "nodejs";

/** GET /api/files?orgId=&projectId=&ownerType=&ownerId=&kind=&page= — org/project file list. */
export const GET = handleApi(async (req: NextRequest) => {
  const session = await requireUser();
  const sp = req.nextUrl.searchParams;
  const orgId = sp.get("orgId") ?? "";
  const page = parsePositiveInt(sp.get("page"), 1);
  const pageSize = parsePositiveInt(sp.get("pageSize"), 30, 100);
  const result = await listFiles(String(session.user._id), orgId, {
    projectId: sp.get("projectId") ?? undefined,
    ownerType: sp.get("ownerType") ?? undefined,
    ownerId: sp.get("ownerId") ?? undefined,
    kind: sp.get("kind") ?? undefined,
    page,
    pageSize,
  });
  return ok(result);
});

/**
 * POST /api/files — multipart upload.
 * Fields: kind (avatar|task_attachment|comment_attachment|project_file|message_attachment),
 *         file (binary), and scope ids: orgId (avatar), projectId, taskId, commentId, conversationId.
 */
export const POST = handleApi(async (req: NextRequest) => {
  const session = await requireUser();
  const form = await req.formData();
  const kind = String(form.get("kind") ?? "");
  const file = form.get("file");
  if (!(file instanceof File)) throw new Error("Missing file field");
  const bytes = Buffer.from(await file.arrayBuffer());
  const uploaded = await uploadFile(String(session.user._id), {
    kind: kind as never,
    fileName: file.name || "file.bin",
    mime: file.type || "application/octet-stream",
    bytes,
    organizationId: form.get("orgId") ? String(form.get("orgId")) : undefined,
    projectId: form.get("projectId") ? String(form.get("projectId")) : undefined,
    taskId: form.get("taskId") ? String(form.get("taskId")) : undefined,
    commentId: form.get("commentId") ? String(form.get("commentId")) : undefined,
    conversationId: form.get("conversationId") ? String(form.get("conversationId")) : undefined,
  });
  return ok({ file: uploaded }, { status: 201 });
});
