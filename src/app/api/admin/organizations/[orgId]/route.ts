import type { NextRequest } from "next/server";
import { handleApi, ok, parseBody } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { requirePlatformAdmin, setOrgPlan } from "@/server/services/admin.service";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({ plan: z.enum(["free", "pro", "business"]) });

type Ctx = { params: Promise<{ orgId: string }> };

/** PATCH /api/admin/organizations/:orgId — adjust plan (e.g. trial grants). */
export const PATCH = handleApi(async (req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  await requirePlatformAdmin(session.user.email);
  const { orgId } = await ctx.params;
  const body = await parseBody(req, schema);
  const result = await setOrgPlan(session.user.email, orgId, body.plan);
  return ok(result);
});
