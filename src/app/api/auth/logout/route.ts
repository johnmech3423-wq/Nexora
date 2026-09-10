import type { NextRequest } from "next/server";
import { handleApi, ok } from "@/server/api";
import { logout } from "@/server/auth/auth.service";
import { clearSessionCookie, requireUser } from "@/server/auth/session";

export const runtime = "nodejs";

export const POST = handleApi(async (_req: NextRequest) => {
  const session = await requireUser();
  await logout(session.sessionId, String(session.user._id));
  await clearSessionCookie();
  return ok({ loggedOut: true });
});
