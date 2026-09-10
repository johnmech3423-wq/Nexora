import type { NextRequest } from "next/server";
import { handleApi, ok } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { toggleProjectFavorite } from "@/server/services/project.service";

export const runtime = "nodejs";

export const POST = handleApi(async (_req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) => {
  const session = await requireUser();
  const { projectId } = await ctx.params;
  const result = await toggleProjectFavorite(String(session.user._id), projectId);
  return ok(result);
});
