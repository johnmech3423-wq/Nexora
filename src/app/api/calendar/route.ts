import type { NextRequest } from "next/server";
import { handleApi, ok } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { calendarEvents } from "@/server/services/calendar.service";

export const runtime = "nodejs";

/** GET /api/calendar?orgId=&from=ISO&to=ISO&projectId= — merged task/milestone/sprint timeline. */
export const GET = handleApi(async (req: NextRequest) => {
  const session = await requireUser();
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) throw new Error("Missing orgId query param");
  const from = new Date(req.nextUrl.searchParams.get("from") ?? Date.now() - 7 * 86400000);
  const to = new Date(req.nextUrl.searchParams.get("to") ?? Date.now() + 30 * 86400000);
  const projectId = req.nextUrl.searchParams.get("projectId");
  const items = await calendarEvents(String(session.user._id), orgId, {
    from,
    to,
    projectId: projectId ?? null,
  });
  return ok({ items });
});
