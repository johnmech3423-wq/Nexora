import type { NextRequest } from "next/server";
import { handleApi, ok, parseBody } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { createSprint, listSprints } from "@/server/services/sprint.service";
import { createSprintSchema } from "@/validations/sprint.schema";

export const runtime = "nodejs";

export const GET = handleApi(async (req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) => {
  const session = await requireUser();
  const { projectId } = await ctx.params;
  const includeCompleted = req.nextUrl.searchParams.get("include") !== "active";
  const sprints = await listSprints(String(session.user._id), projectId, includeCompleted);
  return ok({ sprints });
});

export const POST = handleApi(async (req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) => {
  const session = await requireUser();
  const { projectId } = await ctx.params;
  const body = await parseBody(req, createSprintSchema);
  const sprint = await createSprint(String(session.user._id), projectId, body);
  return ok({ sprint }, { status: 201 });
});
