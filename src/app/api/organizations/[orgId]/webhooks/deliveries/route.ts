import type { NextRequest } from "next/server";
import { handleApi, ok } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { listDeliveries } from "@/server/services/webhook.service";
import { parsePositiveInt } from "@/lib/utils";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ orgId: string }> };

/** GET — delivery log (attempts/status/errors per outbound call). */
export const GET = handleApi(async (req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { orgId } = await ctx.params;
  const page = parsePositiveInt(req.nextUrl.searchParams.get("page"), 1);
  const pageSize = parsePositiveInt(req.nextUrl.searchParams.get("pageSize"), 20, 100);
  const endpointId = req.nextUrl.searchParams.get("endpointId") ?? undefined;
  const result = await listDeliveries(String(session.user._id), orgId, { page, pageSize, endpointId });
  return ok(result);
});
