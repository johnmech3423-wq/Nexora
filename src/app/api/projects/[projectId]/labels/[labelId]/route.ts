import type { NextRequest } from "next/server";
import { handleApi, ok, parseBody } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { deleteProjectLabel, updateProjectLabel } from "@/server/services/project.service";
import { labelInputSchema } from "@/validations/project.schema";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ projectId: string; labelId: string }> };

export const PATCH = handleApi(async (req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { projectId, labelId } = await ctx.params;
  const body = await parseBody(req, labelInputSchema);
  await updateProjectLabel(String(session.user._id), projectId, labelId, body);
  return ok({ updated: true });
});

export const DELETE = handleApi(async (_req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { projectId, labelId } = await ctx.params;
  await deleteProjectLabel(String(session.user._id), projectId, labelId);
  return ok({ deleted: true });
});
