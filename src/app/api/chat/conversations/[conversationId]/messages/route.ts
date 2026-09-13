import type { NextRequest } from "next/server";
import { handleApi, ok, parseBody } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { sendMessage } from "@/server/services/chat.service";
import { sendMessageSchema } from "@/validations/chat.schema";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ conversationId: string }> };

/** POST — send a message (body supports @[Name](id) mentions; optional attachments/reply). */
export const POST = handleApi(async (req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { conversationId } = await ctx.params;
  const body = await parseBody(req, sendMessageSchema);
  const message = await sendMessage(String(session.user._id), conversationId, {
    body: body.body,
    parentId: body.parentId ?? null,
    attachmentFileIds: body.attachmentFileIds,
  });
  return ok({ message }, { status: 201 });
});
