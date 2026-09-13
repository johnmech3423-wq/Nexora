import type { NextRequest } from "next/server";
import { handleApi, ok } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { orgTimeReport } from "@/server/services/time-entry.service";
import { timeQuerySchema } from "@/validations/time-entry.schema";

export const runtime = "nodejs";

/** GET /api/time-entries?orgId=&userId=&projectId=&taskId=&from=&to=&page=&pageSize= — org-wide time report. */
export const GET = handleApi(async (req: NextRequest) => {
  const session = await requireUser();
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) throw new Error("Missing orgId query param");
  const sp = req.nextUrl.searchParams;
  const parsed = timeQuerySchema.safeParse({
    page: sp.get("page"),
    pageSize: sp.get("pageSize"),
    userId: sp.get("userId"),
    projectId: sp.get("projectId"),
    taskId: sp.get("taskId"),
    from: sp.get("from"),
    to: sp.get("to"),
  });
  const q = parsed.success ? parsed.data : {};
  const report = await orgTimeReport(String(session.user._id), orgId, {
    page: q.page ?? 1,
    pageSize: q.pageSize ?? 20,
    userId: q.userId,
    projectId: q.projectId,
    taskId: q.taskId,
    from: q.from,
    to: q.to,
  });
  return ok(report);
});
