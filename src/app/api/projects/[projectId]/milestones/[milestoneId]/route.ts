import type { NextRequest } from "next/server";
import { handleApi, ok, parseBody } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { deleteMilestone, getMilestone, updateMilestone } from "@/server/services/milestone.service";
import { updateMilestoneSchema } from "@/validations/sprint.schema";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ projectId: string; milestoneId: string }> };

export const GET = handleApi(async (_req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { projectId, milestoneId } = await ctx.params;
  const milestone = await getMilestone(String(session.user._id), projectId, milestoneId);
  return ok({ milestone });
});

export const PATCH = handleApi(async (req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { projectId, milestoneId } = await ctx.params;
  const body = await parseBody(req, updateMilestoneSchema);
  const milestone = await updateMilestone(String(session.user._id), projectId, milestoneId, body);
  return ok({ milestone });
});

export const DELETE = handleApi(async (_req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { projectId, milestoneId } = await ctx.params;
  await deleteMilestone(String(session.user._id), projectId, milestoneId);
  return ok({ deleted: true });
});
