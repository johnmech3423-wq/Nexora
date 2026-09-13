import type { NextRequest } from "next/server";
import { handleApi, ok } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { cancelSprint } from "@/server/services/sprint.service";

export const runtime = "nodejs";

export const POST = handleApi(async (_req: NextRequest, ctx: { params: Promise<{ projectId: string; sprintId: string }> }) => {
  const session = await requireUser();
  const { projectId, sprintId } = await ctx.params;
  const sprint = await cancelSprint(String(session.user._id), projectId, sprintId);
  return ok({ sprint });
});
