import type { NextRequest } from "next/server";
import { handleApi, ok, parseBody } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import {
  removeMember,
  updateMemberRole,
  updateMemberStatus,
} from "@/server/services/org.service";
import { updateMemberSchema } from "@/validations/org.schema";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ orgId: string; userId: string }> };

export const PATCH = handleApi(async (req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { orgId, userId } = await ctx.params;
  const body = await parseBody(req, updateMemberSchema);

  if (body.role) {
    await updateMemberRole(String(session.user._id), orgId, userId, body.role);
  } else if (body.status) {
    await updateMemberStatus(String(session.user._id), orgId, userId, body.status);
  }
  return ok({ updated: true });
});

export const DELETE = handleApi(async (_req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { orgId, userId } = await ctx.params;
  await removeMember(String(session.user._id), orgId, userId);
  return ok({ removed: true });
});
