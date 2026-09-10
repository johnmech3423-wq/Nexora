import type { NextRequest } from "next/server";
import { handleApi, ok, parseBody } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { createMilestone, listMilestones } from "@/server/services/milestone.service";
import { createMilestoneSchema } from "@/validations/sprint.schema";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ projectId: string }> };

export const GET = handleApi(async (_req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { projectId } = await ctx.params;
  const milestones = await listMilestones(String(session.user._id), projectId);
  return ok({ milestones });
});

export const POST = handleApi(async (req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { projectId } = await ctx.params;
  const body = await parseBody(req, createMilestoneSchema);
  const milestone = await createMilestone(String(session.user._id), projectId, body);
  return ok({ milestone }, { status: 201 });
});
