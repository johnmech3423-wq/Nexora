import type { NextRequest } from "next/server";
import { handleApi, ok, parseBody } from "@/server/api";
import { requestPasswordReset } from "@/server/auth/auth.service";
import { clientIp } from "@/server/http";
import { forgotPasswordSchema } from "@/validations/auth.schema";

export const runtime = "nodejs";

export const POST = handleApi(async (req: NextRequest) => {
  const body = await parseBody(req, forgotPasswordSchema);
  // Always succeeds (or rate limits) — never reveals whether the email exists.
  await requestPasswordReset(body.email, { ip: clientIp(req), userAgent: "" });
  return ok({ sent: true });
});
