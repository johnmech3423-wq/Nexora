import type { NextRequest } from "next/server";
import { handleApi, ok } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { listOrganizations, requirePlatformAdmin } from "@/server/services/admin.service";
import { parsePositiveInt } from "@/lib/utils";

export const runtime = "nodejs";

/** GET /api/admin/organizations?q=&page= */
export const GET = handleApi(async (req: NextRequest) => {
  const session = await requireUser();
  await requirePlatformAdmin(session.user.email);
  const sp = req.nextUrl.searchParams;
  const page = parsePositiveInt(sp.get("page"), 1);
  const pageSize = parsePositiveInt(sp.get("pageSize"), 25, 100);
  const result = await listOrganizations({ q: sp.get("q") ?? undefined, page, pageSize });
  return ok(result);
});
