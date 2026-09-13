import type { NextRequest } from "next/server";
import { handleApi, ok } from "@/server/api";
import { listSessions, revokeOtherSessions } from "@/server/auth/auth.service";
import { requireUser } from "@/server/auth/session";

export const runtime = "nodejs";

export const GET = handleApi(async (_req: NextRequest) => {
  const session = await requireUser();
  const sessions = await listSessions(String(session.user._id));
  return ok({
    sessions: sessions.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      ip: s.ip,
      createdAt: s.createdAt.toISOString(),
      lastActiveAt: s.lastActiveAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
      current: s.id === session.sessionId,
    })),
  });
});

/** "Sign out other devices" */
export const POST = handleApi(async (_req: NextRequest) => {
  const session = await requireUser();
  const revoked = await revokeOtherSessions(String(session.user._id), session.sessionId);
  return ok({ revoked });
});
