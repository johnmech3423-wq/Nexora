import type { NextRequest } from "next/server";
import { z } from "zod";
import { handleApi, ok, parseBody } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { moveTask } from "@/server/services/task.service";

export const runtime = "nodejs";

const moveSchema = z.object({
  taskId: z.string().min(1),
  status: z.string().min(1).max(40),
  position: z.coerce.number().int().min(0).max(10_000),
});

/** POST — move a task to (status, position) inside the board. */
export const POST = handleApi(async (req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) => {
  const session = await requireUser();
  const { projectId } = await ctx.params;
  const body = await parseBody(req, moveSchema);
  await moveTask(String(session.user._id), projectId, body.taskId, body.status, body.position);
  return ok({ moved: true });
});
