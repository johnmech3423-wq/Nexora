import type { NextRequest } from "next/server";
import { handleApi, ok } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { globalSearch } from "@/server/services/search.service";

export const runtime = "nodejs";

/** GET /api/search?orgId=&q= — global search across projects, tasks, comments, chat & people. */
export const GET = handleApi(async (req: NextRequest) => {
  const session = await requireUser();
  const orgId = req.nextUrl.searchParams.get("orgId");
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (!orgId) throw new Error("Missing orgId query param");
  const results = await globalSearch(String(session.user._id), orgId, q);
  return ok(results);
});
