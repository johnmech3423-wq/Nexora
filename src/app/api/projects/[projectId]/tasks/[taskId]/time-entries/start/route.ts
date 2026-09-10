import type { NextRequest } from "next/server";
import { handleApi, ok, parseBody } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { startTimer } from "@/server/services/time-entry.service";
import { timerStartSchema } from "@/validations/time-entry.schema";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ projectId: string; taskId: string }> };

/** POST — start the caller's timer on this task (one running timer per user). */
export const POST = handleApi(async (req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { taskId } = await ctx.params;
  const body = await parseBody(req, timerStartSchema);
  const result = await startTimer(String(session.user._id), taskId, body.description);
  return ok(result, { status: 201 });
});
