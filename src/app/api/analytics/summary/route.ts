import type { NextRequest } from "next/server";
import { handleApi, ok } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { orgSummary } from "@/server/services/analytics.service";

export const runtime = "nodejs";

/** GET /api/analytics/summary?orgId= — org dashboard metrics. */
export const GET = handleApi(async (req: NextRequest) => {
  const session = await requireUser();
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) throw new Error("Missing orgId query param");
  const summary = await orgSummary(String(session.user._id), orgId);
  return ok({ summary });
});
