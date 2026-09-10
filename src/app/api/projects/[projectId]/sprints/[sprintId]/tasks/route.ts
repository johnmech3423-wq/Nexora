import type { NextRequest } from "next/server";
import { handleApi, ok, parseBody } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { setSprintTasks } from "@/server/services/sprint.service";
import { setSprintTasksSchema } from "@/validations/sprint.schema";

export const runtime = "nodejs";

/** POST — replace the set of tasks in this sprint. */
export const POST = handleApi(async (req: NextRequest, ctx: { params: Promise<{ projectId: string; sprintId: string }> }) => {
  const session = await requireUser();
  const { projectId, sprintId } = await ctx.params;
  const body = await parseBody(req, setSprintTasksSchema);
  const result = await setSprintTasks(String(session.user._id), projectId, sprintId, body.taskIds);
  return ok(result);
});
