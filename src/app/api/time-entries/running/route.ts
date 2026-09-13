import type { NextRequest } from "next/server";
import { handleApi, ok } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { getRunningTimer } from "@/server/services/time-entry.service";

export const runtime = "nodejs";

/** GET /api/time-entries/running?orgId= — the caller's running timer, if any. */
export const GET = handleApi(async (req: NextRequest) => {
  const session = await requireUser();
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) throw new Error("Missing orgId query param");
  const running = await getRunningTimer(String(session.user._id), orgId);
  return ok({ running });
});
