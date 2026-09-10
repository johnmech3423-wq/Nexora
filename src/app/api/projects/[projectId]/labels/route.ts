import type { NextRequest } from "next/server";
import { handleApi, ok, parseBody } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { createProjectLabel, deleteProjectLabel, updateProjectLabel } from "@/server/services/project.service";
import { labelInputSchema } from "@/validations/project.schema";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ projectId: string; labelId: string }> };

/** POST /api/projects/:id/labels — create */
export const POST = handleApi(async (req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) => {
  const session = await requireUser();
  const { projectId } = await ctx.params;
  const body = await parseBody(req, labelInputSchema);
  const label = await createProjectLabel(String(session.user._id), projectId, body);
  return ok({ label }, { status: 201 });
});
