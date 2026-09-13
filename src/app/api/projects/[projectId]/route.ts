import type { NextRequest } from "next/server";
import { handleApi, ok, parseBody } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { getProjectDetail, updateProject, deleteProject } from "@/server/services/project.service";
import { updateProjectSchema } from "@/validations/project.schema";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ projectId: string }> };

export const GET = handleApi(async (_req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { projectId } = await ctx.params;
  const project = await getProjectDetail(String(session.user._id), projectId);
  return ok({ project });
});

export const PATCH = handleApi(async (req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { projectId } = await ctx.params;
  const body = await parseBody(req, updateProjectSchema);
  const project = await updateProject(String(session.user._id), projectId, body);
  return ok({ project });
});

export const DELETE = handleApi(async (_req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { projectId } = await ctx.params;
  await deleteProject(String(session.user._id), projectId);
  return ok({ deleted: true });
});
