import type { NextRequest } from "next/server";
import { handleApi, ok, parseBody } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { toggleReaction } from "@/server/services/chat.service";
import { reactionSchema } from "@/validations/chat.schema";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ messageId: string }> };

export const POST = handleApi(async (req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { messageId } = await ctx.params;
  const body = await parseBody(req, reactionSchema);
  const reaction = await toggleReaction(String(session.user._id), messageId, body.emoji);
  return ok({ reaction });
});
