import type { NextRequest } from "next/server";
import { handleApi, ok } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { serializeUser, type UserContext } from "@/server/serializers/user";

export const runtime = "nodejs";

export const GET = handleApi(async (_req: NextRequest) => {
  const session = await requireUser();
  const data: UserContext = {
    user: await serializeUser(session.user),
    session: { id: session.sessionId, expiresAt: session.expiresAt.toISOString() },
  };
  return ok(data);
});
