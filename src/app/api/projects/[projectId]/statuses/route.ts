import type { NextRequest } from "next/server";
import { handleApi, ok, parseBody } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { updateProjectStatuses } from "@/server/services/project.service";
import { updateProjectStatusesSchema } from "@/validations/project.schema";

export const runtime = "nodejs";

/** PUT — replace the project's status/column configuration. */
export const PUT = handleApi(async (req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) => {
  const session = await requireUser();
  const { projectId } = await ctx.params;
  const body = await parseBody(req, updateProjectStatusesSchema);
  const statuses = await updateProjectStatuses(String(session.user._id), projectId, body.statuses);
  return ok({ statuses });
});
