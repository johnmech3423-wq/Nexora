import type { NextRequest } from "next/server";
import { handleApi, ok, parseBody } from "@/server/api";
import { enableTwoFactor } from "@/server/auth/auth.service";
import { requireUser } from "@/server/auth/session";
import { enableTwoFactorSchema } from "@/validations/auth.schema";

export const runtime = "nodejs";

export const POST = handleApi(async (req: NextRequest) => {
  const session = await requireUser();
  const body = await parseBody(req, enableTwoFactorSchema);
  await enableTwoFactor(String(session.user._id), body.secret, body.code);
  return ok({ enabled: true });
});
