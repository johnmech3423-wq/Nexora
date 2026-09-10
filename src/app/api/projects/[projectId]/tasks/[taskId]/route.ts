import type { NextRequest } from "next/server";
import { handleApi, ok, parseBody } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { deleteTask, getTaskDetail, updateTask } from "@/server/services/task.service";
import { updateTaskSchema } from "@/validations/task.schema";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ projectId: string; taskId: string }> };

export const GET = handleApi(async (_req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { projectId, taskId } = await ctx.params;
  const task = await getTaskDetail(String(session.user._id), projectId, taskId);
  return ok({ task });
});

export const PATCH = handleApi(async (req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { projectId, taskId } = await ctx.params;
  const body = await parseBody(req, updateTaskSchema);
  const task = await updateTask(String(session.user._id), projectId, taskId, body);
  return ok({ task });
});

export const DELETE = handleApi(async (_req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { projectId, taskId } = await ctx.params;
  await deleteTask(String(session.user._id), projectId, taskId);
  return ok({ deleted: true });
});
