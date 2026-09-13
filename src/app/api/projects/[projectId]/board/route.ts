import type { NextRequest } from "next/server";
import { handleApi, ok } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { getBoard } from "@/server/services/task.service";

export const runtime = "nodejs";

/** GET /api/projects/:id/board?q=&assigneeId=&priority=&labelId=&due= */
export const GET = handleApi(async (req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) => {
  const session = await requireUser();
  const { projectId } = await ctx.params;
  const sp = req.nextUrl.searchParams;
  const board = await getBoard(String(session.user._id), projectId, {
    q: sp.get("q") ?? undefined,
    assigneeId: sp.get("assigneeId") ?? undefined,
    priority: sp.get("priority") ?? undefined,
    labelId: sp.get("labelId") ?? undefined,
    due: sp.get("due") ?? undefined,
  });
  return ok(board);
});
