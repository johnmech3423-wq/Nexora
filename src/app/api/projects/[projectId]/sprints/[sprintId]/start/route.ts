import type { NextRequest } from "next/server";
import { handleApi, ok } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { startSprint } from "@/server/services/sprint.service";

export const runtime = "nodejs";

/** POST /…/sprints/:id/start — start a planned sprint */
export const POST = handleApi(async (_req: NextRequest, ctx: { params: Promise<{ projectId: string; sprintId: string }> }) => {
  const session = await requireUser();
  const { projectId, sprintId } = await ctx.params;
  const sprint = await startSprint(String(session.user._id), projectId, sprintId);
  return ok({ sprint });
});
