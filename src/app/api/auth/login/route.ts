import type { NextRequest } from "next/server";
import { handleApi, ok, parseBody } from "@/server/api";
import { loginWithPassword } from "@/server/auth/auth.service";
import { setSessionCookie } from "@/server/auth/session";
import { clientIp, clientUserAgent } from "@/server/http";
import { loginSchema } from "@/validations/auth.schema";

export const runtime = "nodejs";

export const POST = handleApi(async (req: NextRequest) => {
  const body = await parseBody(req, loginSchema);
  const meta = { ip: clientIp(req), userAgent: clientUserAgent(req) };
  const outcome = await loginWithPassword(body, meta);

  if (outcome.status === "needs_two_factor") {
    return ok({ needsTwoFactor: true, challenge: outcome.challenge });
  }
  await setSessionCookie(outcome.sessionToken!, body.remember);
  return ok({ needsTwoFactor: false });
});
