import type { NextRequest } from "next/server";
import { handleApi, ok, parseBody } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { removeProjectMember, updateProjectMemberRole } from "@/server/services/project.service";
import { updateProjectMemberSchema } from "@/validations/project.schema";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ projectId: string; userId: string }> };

export const PATCH = handleApi(async (req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { projectId, userId } = await ctx.params;
  const body = await parseBody(req, updateProjectMemberSchema);
  await updateProjectMemberRole(String(session.user._id), projectId, userId, body.role);
  return ok({ updated: true });
});

export const DELETE = handleApi(async (_req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { projectId, userId } = await ctx.params;
  await removeProjectMember(String(session.user._id), projectId, userId);
  return ok({ removed: true });
});
