import type { NextRequest } from "next/server";
import { handleApi, ok, parseBody } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { addProjectMember } from "@/server/services/project.service";
import { addProjectMemberSchema } from "@/validations/project.schema";

export const runtime = "nodejs";

/** POST — add an org member to the project. body: { userId, role? } */
export const POST = handleApi(async (req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) => {
  const session = await requireUser();
  const { projectId } = await ctx.params;
  const body = await parseBody(req, addProjectMemberSchema);
  const members = await addProjectMember(String(session.user._id), projectId, body.userId, body.role ?? "member");
  return ok({ members }, { status: 201 });
});
