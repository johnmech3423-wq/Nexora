import type { NextRequest } from "next/server";
import { handleApi, ok } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { deleteNotification, markNotificationRead } from "@/server/services/notification.service";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** POST — mark one notification as read. */
export const POST = handleApi(async (_req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { id } = await ctx.params;
  await markNotificationRead(String(session.user._id), id);
  return ok({ updated: true });
});

export const DELETE = handleApi(async (_req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { id } = await ctx.params;
  await deleteNotification(String(session.user._id), id);
  return ok({ deleted: true });
});
