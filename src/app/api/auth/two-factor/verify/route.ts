import type { NextRequest } from "next/server";
import { handleApi, ok, parseBody } from "@/server/api";
import { completeTwoFactorLogin } from "@/server/auth/auth.service";
import { setSessionCookie } from "@/server/auth/session";
import { clientIp, clientUserAgent } from "@/server/http";
import { twoFactorLoginSchema } from "@/validations/auth.schema";

export const runtime = "nodejs";

/** POST /api/auth/two-factor/verify — completes a challenged login. */
export const POST = handleApi(async (req: NextRequest) => {
  const body = await parseBody(req, twoFactorLoginSchema);
  const meta = { ip: clientIp(req), userAgent: clientUserAgent(req) };
  const outcome = await completeTwoFactorLogin({ code: body.code, challenge: body.challenge }, meta);
  if (outcome.status !== "ok" || !outcome.sessionToken) {
    throw new Error("Unexpected two-factor outcome");
  }
  await setSessionCookie(outcome.sessionToken);
  return ok({ verified: true });
});
