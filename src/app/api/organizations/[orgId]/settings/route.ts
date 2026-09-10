import type { NextRequest } from "next/server";
import { handleApi, ok, parseBody } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { updateOrgSettings } from "@/server/services/org.service";
import { updateOrgSettingsSchema } from "@/validations/org.schema";

export const runtime = "nodejs";

export const PATCH = handleApi(async (req: NextRequest, ctx: { params: Promise<{ orgId: string }> }) => {
  const session = await requireUser();
  const { orgId } = await ctx.params;
  const body = await parseBody(req, updateOrgSettingsSchema);
  await updateOrgSettings(String(session.user._id), orgId, body);
  return ok({ updated: true });
});
