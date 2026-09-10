import type { NextRequest } from "next/server";
import { handleApi, ok } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { workload } from "@/server/services/analytics.service";

export const runtime = "nodejs";

/** GET /api/analytics/workload?orgId= — per-member open/in-progress/overdue + tracked time. */
export const GET = handleApi(async (req: NextRequest) => {
  const session = await requireUser();
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) throw new Error("Missing orgId query param");
  const items = await workload(String(session.user._id), orgId);
  return ok({ items });
});
