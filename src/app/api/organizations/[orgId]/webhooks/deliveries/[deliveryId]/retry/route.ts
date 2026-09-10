import type { NextRequest } from "next/server";
import { handleApi, ok } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { retryDelivery } from "@/server/services/webhook.service";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ orgId: string; deliveryId: string }> };

export const POST = handleApi(async (_req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { orgId, deliveryId } = await ctx.params;
  const result = await retryDelivery(String(session.user._id), orgId, deliveryId);
  return ok(result);
});
