import type { NextRequest } from "next/server";
import { handleApi, ok } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { onlineMembers } from "@/server/services/chat.service";

export const runtime = "nodejs";

/** GET /api/chat/presence?orgId= — members active in the last 2 minutes. */
export const GET = handleApi(async (req: NextRequest) => {
  const session = await requireUser();
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) throw new Error("Missing orgId query param");
  const items = await onlineMembers(String(session.user._id), orgId);
  return ok({ items, asOf: new Date().toISOString() });
});
