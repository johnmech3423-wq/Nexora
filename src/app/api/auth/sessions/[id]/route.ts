import type { NextRequest } from "next/server";
import { handleApi, ok } from "@/server/api";
import { revokeOneSession } from "@/server/auth/auth.service";
import { requireUser } from "@/server/auth/session";

export const runtime = "nodejs";

export const DELETE = handleApi(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireUser();
  const { id } = await ctx.params;
  if (!id) throw new Error("Missing session id");
  await revokeOneSession(String(session.user._id), id);
  return ok({ revoked: true, current: id === session.sessionId });
});
