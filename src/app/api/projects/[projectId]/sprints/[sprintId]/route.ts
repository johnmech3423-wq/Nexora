import type { NextRequest } from "next/server";
import { handleApi, ok, parseBody } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { getSprint, updateSprint } from "@/server/services/sprint.service";
import { updateSprintSchema } from "@/validations/sprint.schema";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ projectId: string; sprintId: string }> };

export const GET = handleApi(async (_req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { projectId, sprintId } = await ctx.params;
  const sprint = await getSprint(String(session.user._id), projectId, sprintId);
  return ok({ sprint });
});

export const PATCH = handleApi(async (req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { projectId, sprintId } = await ctx.params;
  const body = await parseBody(req, updateSprintSchema);
  const sprint = await updateSprint(String(session.user._id), projectId, sprintId, body);
  return ok({ sprint });
});
