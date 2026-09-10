import type { NextRequest } from "next/server";
import { handleApi, ok, parseBody } from "@/server/api";
import { disableTwoFactor } from "@/server/auth/auth.service";
import { requireUser } from "@/server/auth/session";
import { disableTwoFactorSchema } from "@/validations/auth.schema";

export const runtime = "nodejs";

export const POST = handleApi(async (req: NextRequest) => {
  const session = await requireUser();
  const body = await parseBody(req, disableTwoFactorSchema);
  await disableTwoFactor(String(session.user._id), body.code);
  return ok({ disabled: true });
});
