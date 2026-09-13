import type { NextRequest } from "next/server";
import { handleApi, ok } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { broadcastTyping } from "@/server/services/chat.service";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ conversationId: string }> };

/** POST — typing indicator (clients throttle to ~2s). */
export const POST = handleApi(async (_req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { conversationId } = await ctx.params;
  await broadcastTyping(String(session.user._id), conversationId);
  return ok({ sent: true });
});
