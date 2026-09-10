import type { NextRequest } from "next/server";
import { handleApi, ok } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { leaveOrganization } from "@/server/services/org.service";

export const runtime = "nodejs";

export const POST = handleApi(async (_req: NextRequest, ctx: { params: Promise<{ orgId: string }> }) => {
  const session = await requireUser();
  const { orgId } = await ctx.params;
  await leaveOrganization(String(session.user._id), orgId);
  return ok({ left: true });
});
