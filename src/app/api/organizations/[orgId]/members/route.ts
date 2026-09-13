import type { NextRequest } from "next/server";
import { handleApi, ok } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { listMembers } from "@/server/services/org.service";

export const runtime = "nodejs";

export const GET = handleApi(async (_req: NextRequest, ctx: { params: Promise<{ orgId: string }> }) => {
  const session = await requireUser();
  const { orgId } = await ctx.params;
  const members = await listMembers(String(session.user._id), orgId);
  return ok({ members });
});
