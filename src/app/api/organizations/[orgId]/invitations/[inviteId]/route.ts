import type { NextRequest } from "next/server";
import { handleApi, ok } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { revokeInvitation } from "@/server/services/invitation.service";

export const runtime = "nodejs";

/** DELETE — revoke a pending invitation. */
export const DELETE = handleApi(async (_req: NextRequest, ctx: { params: Promise<{ orgId: string; inviteId: string }> }) => {
  const session = await requireUser();
  const { orgId, inviteId } = await ctx.params;
  await revokeInvitation(String(session.user._id), orgId, inviteId);
  return ok({ revoked: true });
});
