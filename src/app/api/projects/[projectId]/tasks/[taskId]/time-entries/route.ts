import type { NextRequest } from "next/server";
import { handleApi, ok, parseBody } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { createManualEntry, listTaskTimeEntries } from "@/server/services/time-entry.service";
import { manualTimeEntrySchema } from "@/validations/time-entry.schema";
import { parsePositiveInt } from "@/lib/utils";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ projectId: string; taskId: string }> };

/** GET — time entries for one task. */
export const GET = handleApi(async (req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { taskId } = await ctx.params;
  const page = parsePositiveInt(req.nextUrl.searchParams.get("page"), 1);
  const pageSize = parsePositiveInt(req.nextUrl.searchParams.get("pageSize"), 20, 100);
  return ok(await listTaskTimeEntries(String(session.user._id), taskId, { page, pageSize }));
});

/** POST — log a manual time entry against this task. */
export const POST = handleApi(async (req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { taskId } = await ctx.params;
  const body = await parseBody(req, manualTimeEntrySchema);
  const entry = await createManualEntry(String(session.user._id), taskId, body);
  return ok({ entry }, { status: 201 });
});
