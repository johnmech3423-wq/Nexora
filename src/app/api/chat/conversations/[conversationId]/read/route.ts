import type { NextRequest } from "next/server";
import { handleApi, ok } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { markConversationRead } from "@/server/services/chat.service";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ conversationId: string }> };

/** POST — mark this conversation read up to now. */
export const POST = handleApi(async (_req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { conversationId } = await ctx.params;
  await markConversationRead(String(session.user._id), conversationId);
  return ok({ updated: true });
});
