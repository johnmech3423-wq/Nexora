import type { NextRequest } from "next/server";
import { handleApi, ok } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { stopTimer } from "@/server/services/time-entry.service";

export const runtime = "nodejs";

/** POST /api/time-entries/stop — stop the caller's running timer anywhere. */
export const POST = handleApi(async () => {
  const session = await requireUser();
  const result = await stopTimer(String(session.user._id));
  return ok(result);
});
