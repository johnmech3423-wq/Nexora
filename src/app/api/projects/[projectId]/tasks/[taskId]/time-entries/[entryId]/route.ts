import type { NextRequest } from "next/server";
import { handleApi, ok } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { deleteTimeEntry } from "@/server/services/time-entry.service";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ projectId: string; taskId: string; entryId: string }> };

/** DELETE — soft-delete a time entry (author or org admin). */
export const DELETE = handleApi(async (_req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { entryId } = await ctx.params;
  await deleteTimeEntry(String(session.user._id), entryId);
  return ok({ deleted: true });
});
