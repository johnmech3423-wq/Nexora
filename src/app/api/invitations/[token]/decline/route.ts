import type { NextRequest } from "next/server";
import { handleApi, ok } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { declineInvitation } from "@/server/services/invitation.service";

export const runtime = "nodejs";

export const POST = handleApi(async (_req: NextRequest, ctx: { params: Promise<{ token: string }> }) => {
  const session = await requireUser();
  const { token } = await ctx.params;
  await declineInvitation(String(session.user._id), token);
  return ok({ declined: true });
});
