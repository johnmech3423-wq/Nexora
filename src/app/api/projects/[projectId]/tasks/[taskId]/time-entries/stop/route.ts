import type { NextRequest } from "next/server";
import { handleApi, ok, parseBody } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { stopTimer } from "@/server/services/time-entry.service";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ projectId: string; taskId: string }> };

/** POST — stop the caller's running timer on this task. */
export const POST = handleApi(async (_req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { taskId } = await ctx.params;
  const result = await stopTimer(String(session.user._id), taskId);
  return ok(result);
});
