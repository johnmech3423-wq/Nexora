import type { NextRequest } from "next/server";
import { handleApi, ok } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { archiveProject } from "@/server/services/project.service";

export const runtime = "nodejs";

/** POST /api/projects/[projectId]/archive  body: { archived: boolean } */
export const POST = handleApi(async (req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) => {
  const session = await requireUser();
  const { projectId } = await ctx.params;
  const raw = await req.json().catch(() => ({}));
  const archived = raw?.archived !== false; // default: archive
  await archiveProject(String(session.user._id), projectId, !archived);
  return ok({ archived });
});
