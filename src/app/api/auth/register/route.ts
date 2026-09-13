import type { NextRequest } from "next/server";
import { handleApi, ok, parseBody } from "@/server/api";
import { registerUser } from "@/server/auth/auth.service";
import { setSessionCookie } from "@/server/auth/session";
import { clientIp, clientUserAgent } from "@/server/http";
import { registerSchema } from "@/validations/auth.schema";
import { assertRateLimit } from "@/server/security/rate-limit";
import { getRuntimeConfig } from "@/server/services/platform-config.service";
import { ApiError } from "@/server/errors";

export const runtime = "nodejs";

export const POST = handleApi(async (req: NextRequest) => {
  const runtime = await getRuntimeConfig();
  if (!runtime.platform.allowRegistration) throw ApiError.conflict("New registrations are currently disabled by the platform administrator.");
  await assertRateLimit("register:ip", clientIp(req), 5, 60 * 60_000, "Too many sign-ups from this device. Try again later.");
  const body = await parseBody(req, registerSchema);
  const meta = { ip: clientIp(req), userAgent: clientUserAgent(req) };
  const outcome = await registerUser(body, meta);
  await setSessionCookie(outcome.sessionToken!, body.remember);
  return ok({ registered: true, emailVerified: false });
});
