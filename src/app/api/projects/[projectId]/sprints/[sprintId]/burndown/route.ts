import type { NextRequest } from "next/server";
import { handleApi, ok } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { sprintBurndown } from "@/server/services/sprint.service";

export const runtime = "nodejs";

export const GET = handleApi(async (req: NextRequest, ctx: { params: Promise<{ projectId: string; sprintId: string }> }) => {
  const session = await requireUser();
  const { projectId, sprintId } = await ctx.params;
  const days = Math.min(90, Math.max(2, Number(req.nextUrl.searchParams.get("days") ?? 14) || 14));
  const result = await sprintBurndown(String(session.user._id), projectId, sprintId, days);
  return ok(result);
});
