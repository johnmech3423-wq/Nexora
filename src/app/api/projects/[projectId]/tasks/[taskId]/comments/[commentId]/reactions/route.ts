import type { NextRequest } from "next/server";
import { handleApi, ok, parseBody } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { toggleCommentReaction } from "@/server/services/comment.service";
import { toggleReactionSchema } from "@/validations/task.schema";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ projectId: string; taskId: string; commentId: string }> };

export const POST = handleApi(async (req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { projectId, commentId } = await ctx.params;
  const body = await parseBody(req, toggleReactionSchema);
  const reaction = await toggleCommentReaction(String(session.user._id), projectId, commentId, body.emoji);
  return ok({ reaction });
});
