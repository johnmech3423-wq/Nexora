import type { NextRequest } from "next/server";
import { handleApi, ok, parseBody } from "@/server/api";
import { changePassword } from "@/server/auth/auth.service";
import { requireUser } from "@/server/auth/session";
import { changePasswordSchema } from "@/validations/auth.schema";

export const runtime = "nodejs";

export const POST = handleApi(async (req: NextRequest) => {
  const session = await requireUser();
  const body = await parseBody(req, changePasswordSchema);
  await changePassword(String(session.user._id), body, session.sessionId, true);
  return ok({ changed: true });
});
