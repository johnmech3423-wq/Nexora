import type { NextRequest } from "next/server";
import { handleApi, ok } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { trends } from "@/server/services/analytics.service";
import { parsePositiveInt } from "@/lib/utils";

export const runtime = "nodejs";

/** GET /api/analytics/trends?orgId=&days=30 — created/completed/overdue per day (Pro+). */
export const GET = handleApi(async (req: NextRequest) => {
  const session = await requireUser();
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) throw new Error("Missing orgId query param");
  const days = Math.min(parsePositiveInt(req.nextUrl.searchParams.get("days"), 30, 365), 365);
  const items = await trends(String(session.user._id), orgId, days);
  return ok({ items });
});
