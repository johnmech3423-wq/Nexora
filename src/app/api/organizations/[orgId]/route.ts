import type { NextRequest } from "next/server";
import { handleApi, ok, parseBody } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import {
  getOrganizationDetail,
  updateOrganization,
  deleteOrganization,
} from "@/server/services/org.service";
import { updateOrgSchema } from "@/validations/org.schema";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ orgId: string }> };

export const GET = handleApi(async (_req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { orgId } = await ctx.params;
  const organization = await getOrganizationDetail(String(session.user._id), orgId);
  return ok({ organization });
});

export const PATCH = handleApi(async (req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { orgId } = await ctx.params;
  const body = await parseBody(req, updateOrgSchema);
  const organization = await updateOrganization(String(session.user._id), orgId, body);
  return ok({ organization });
});

export const DELETE = handleApi(async (_req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { orgId } = await ctx.params;
  await deleteOrganization(String(session.user._id), orgId);
  return ok({ deleted: true });
});
