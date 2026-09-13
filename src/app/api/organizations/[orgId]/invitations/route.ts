import type { NextRequest } from "next/server";
import { handleApi, ok, parseBody } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { inviteMembers, listInvitations } from "@/server/services/invitation.service";
import { inviteSchema } from "@/validations/org.schema";

export const runtime = "nodejs";

export const GET = handleApi(async (_req: NextRequest, ctx: { params: Promise<{ orgId: string }> }) => {
  const session = await requireUser();
  const { orgId } = await ctx.params;
  const invitations = await listInvitations(String(session.user._id), orgId);
  return ok({ invitations });
});

export const POST = handleApi(async (req: NextRequest, ctx: { params: Promise<{ orgId: string }> }) => {
  const session = await requireUser();
  const { orgId } = await ctx.params;
  const body = await parseBody(req, inviteSchema);
  const result = await inviteMembers(String(session.user._id), orgId, body);
  return ok(result, { status: 201 });
});
