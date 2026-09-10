import type { NextRequest } from "next/server";
import { handleApi, ok, parseBody } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { createTask, listTasks } from "@/server/services/task.service";
import { createTaskSchema, taskQuerySchema } from "@/validations/task.schema";

export const runtime = "nodejs";

/** GET /api/projects/:id/tasks — list with filters & pagination */
export const GET = handleApi(async (req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) => {
  const session = await requireUser();
  const { projectId } = await ctx.params;
  const sp = req.nextUrl.searchParams;
  const parsed = taskQuerySchema.safeParse({
    page: sp.get("page"),
    pageSize: sp.get("pageSize"),
    q: sp.get("q"),
    status: sp.get("status"),
    priority: sp.get("priority"),
    assigneeId: sp.get("assigneeId"),
    reporterId: sp.get("reporterId"),
    labelId: sp.get("labelId"),
    sprintId: sp.get("sprintId"),
    milestoneId: sp.get("milestoneId"),
    parentId: sp.get("parentId") === "none" ? null : sp.get("parentId"),
    due: sp.get("due"),
    sort: sp.get("sort"),
    statuses: sp.getAll("status"),
  });
  const q = parsed.success ? parsed.data : {};
  const result = await listTasks(String(session.user._id), projectId, {
    page: q.page ?? 1,
    pageSize: q.pageSize ?? 20,
    q: q.q,
    status: q.status,
    statuses: q.statuses,
    priority: q.priority,
    assigneeId: q.assigneeId,
    reporterId: q.reporterId,
    labelId: q.labelId,
    sprintId: q.sprintId,
    milestoneId: q.milestoneId,
    parentId: q.parentId,
    due: q.due,
    sort: q.sort,
  });
  return ok(result);
});

/** POST — create a task. */
export const POST = handleApi(async (req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) => {
  const session = await requireUser();
  const { projectId } = await ctx.params;
  const body = await parseBody(req, createTaskSchema);
  const task = await createTask(String(session.user._id), projectId, body);
  return ok({ task }, { status: 201 });
});
