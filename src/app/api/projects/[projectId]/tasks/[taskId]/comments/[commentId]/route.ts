import type { NextRequest } from "next/server";
import { handleApi, ok, parseBody } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { deleteComment, updateComment } from "@/server/services/comment.service";
import { updateCommentSchema } from "@/validations/task.schema";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ projectId: string; taskId: string; commentId: string }> };

export const PATCH = handleApi(async (req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { projectId, commentId } = await ctx.params;
  const body = await parseBody(req, updateCommentSchema);
  const comment = await updateComment(String(session.user._id), projectId, commentId, body.body);
  return ok({ comment });
});

export const DELETE = handleApi(async (_req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { projectId, commentId } = await ctx.params;
  await deleteComment(String(session.user._id), projectId, commentId);
  return ok({ deleted: true });
});
