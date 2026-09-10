import type { NextRequest } from "next/server";
import { handleApi, ok, parseBody } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { deleteMessage, updateMessage } from "@/server/services/chat.service";
import { updateMessageSchema } from "@/validations/chat.schema";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ messageId: string }> };

export const PATCH = handleApi(async (req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { messageId } = await ctx.params;
  const body = await parseBody(req, updateMessageSchema);
  const message = await updateMessage(String(session.user._id), messageId, body.body);
  return ok({ message });
});

export const DELETE = handleApi(async (_req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { messageId } = await ctx.params;
  await deleteMessage(String(session.user._id), messageId);
  return ok({ deleted: true });
});
