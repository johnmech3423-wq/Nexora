import type { NextRequest } from "next/server";
import { handleApi, ok, parseBody } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { addComment, listComments } from "@/server/services/comment.service";
import { addCommentSchema } from "@/validations/task.schema";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ projectId: string; taskId: string }> };

export const GET = handleApi(async (req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { projectId, taskId } = await ctx.params;
  const page = Number(req.nextUrl.searchParams.get("page") ?? 1) || 1;
  const result = await listComments(String(session.user._id), projectId, taskId, page);
  return ok(result);
});

export const POST = handleApi(async (req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { projectId, taskId } = await ctx.params;
  const body = await parseBody(req, addCommentSchema);
  const comment = await addComment(String(session.user._id), projectId, taskId, body);
  return ok({ comment }, { status: 201 });
});
