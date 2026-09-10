import type { NextRequest } from "next/server";
import { handleApi, ok } from "@/server/api";
import { getInvitationPreview } from "@/server/services/invitation.service";

export const runtime = "nodejs";

/** Public preview of an invitation (safe, minimal info). */
export const GET = handleApi(async (_req: NextRequest, ctx: { params: Promise<{ token: string }> }) => {
  const { token } = await ctx.params;
  const invitation = await getInvitationPreview(token);
  return ok({ invitation });
});
