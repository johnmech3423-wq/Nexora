import type { NextRequest } from "next/server";
import { handleApi, ok, parseBody } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { z } from "zod";
import { ApiError } from "@/server/errors";
import { connectDb } from "@/server/db/db";
import { Task } from "@/server/db/models/task.model";
import { assertProjectPermission } from "@/server/authorization/guard";
import { logActivity } from "@/server/services/activity.service";

export const runtime = "nodejs";

const schema = z.object({ watching: z.boolean().optional() });

type Ctx = { params: Promise<{ projectId: string; taskId: string }> };

/** POST — watch or unwatch a task (actor-based; assignment auto-watches). */
export const POST = handleApi(async (req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { projectId, taskId } = await ctx.params;
  const body = await parseBody(req, schema);
  await assertProjectPermission(String(session.user._id), projectId, "task.read");
  await connectDb();
  const task = await Task.findOne({ _id: taskId, projectId, deletedAt: null });
  if (!task) throw ApiError.notFound("That task does not exist.");

  const watching = body.watching !== false;
  const userId = String(session.user._id);
  const watchers: string[] = (task.watchers ?? []).map((w) => String(w));
  const already = watchers.includes(userId);
  if (watching && !already) {
    task.watchers.push(userId as unknown as (typeof task.watchers)[number]);
  } else if (!watching && already) {
    task.watchers = task.watchers.filter((w) => String(w) !== userId) as typeof task.watchers;
  }
  await task.save();
  void logActivity({
    organizationId: String(task.organizationId),
    actorId: userId,
    action: watching ? "task.watch" : "task.watch",
    entityType: "task",
    entityId: taskId,
    projectId,
    metadata: { watching },
  });
  return ok({ watching });
});
