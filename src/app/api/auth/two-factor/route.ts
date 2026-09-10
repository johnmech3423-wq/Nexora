import type { NextRequest } from "next/server";
import { handleApi, ok } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { provisionTwoFactor } from "@/server/auth/auth.service";

export const runtime = "nodejs";

/** GET /api/auth/two-factor → provision a new TOTP secret (display once). */
export const GET = handleApi(async (_req: NextRequest) => {
  const session = await requireUser();
  const { secret, otpauthUrl } = provisionTwoFactor(session.user.email);
  return ok({ secret, otpauthUrl, account: session.user.email });
});
