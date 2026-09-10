import { cookies } from "next/headers";
import { Session } from "@/server/db/models/session.model";
import { User, type UserDoc } from "@/server/db/models/user.model";
import { connectDb } from "@/server/db/db";
import { ApiError } from "@/server/errors";
import { createRandomToken, hashToken } from "@/server/security/tokens";

export const SESSION_COOKIE = "nexora_session";
const SESSION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const REMEMBER_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export interface ActiveSession {
  sessionId: string;
  user: UserDoc & { _id: unknown };
  expiresAt: Date;
}

export function sessionCookieName(): string {
  return SESSION_COOKIE;
}

/** Secure, httpOnly, SameSite=Lax cookie config. */
function cookieAttributes(expiresAt: Date): {
  httpOnly: boolean;
  sameSite: "lax";
  secure: boolean;
  path: string;
  expires: Date;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  };
}

export async function createSession(input: {
  userId: string;
  userAgent: string;
  ip: string;
  remember?: boolean;
}): Promise<string> {
  await connectDb();
  const token = createRandomToken();
  const expiresAt = new Date(Date.now() + (input.remember ? REMEMBER_MS : SESSION_MS));
  await Session.create({
    tokenHash: hashToken(token),
    userId: input.userId,
    userAgent: input.userAgent.slice(0, 512),
    ip: input.ip,
    expiresAt,
  });
  return token;
}

export async function setSessionCookie(token: string, remember?: boolean): Promise<void> {
  const expiresAt = new Date(Date.now() + (remember ? REMEMBER_MS : SESSION_MS));
  (await cookies()).set(SESSION_COOKIE, token, cookieAttributes(expiresAt));
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, "", {
    ...cookieAttributes(new Date(0)),
    maxAge: 0,
  });
}

export async function getRawSessionToken(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

/**
 * Resolves the current user from the session cookie. Throws
 * ApiError(401) when missing/expired/revoked — route handlers can
 * simply call this and be guaranteed an authenticated user.
 */
export async function requireUser(context?: { ip?: string; userAgent?: string }): Promise<ActiveSession> {
  await connectDb();
  const token = await getRawSessionToken();
  if (!token) throw ApiError.unauthorized();

  const session = await Session.findOne({
    tokenHash: hashToken(token),
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  });
  if (!session) throw ApiError.unauthorized("Your session has expired. Please sign in again.");

  const user = await User.findById(session.userId).where("deletedAt").equals(null);
  if (!user) throw ApiError.unauthorized();

  // Throttled last-active refresh (avoids a write per request).
  if (Date.now() - session.lastActiveAt.getTime() > TOUCH_INTERVAL_MS) {
    session.lastActiveAt = new Date();
    await session.save().catch(() => undefined);
  }

  return {
    sessionId: String(session._id),
    user,
    expiresAt: session.expiresAt,
  };
}

/** Non-throwing variant used by pages (return null when signed out). */
export async function getOptionalUser(): Promise<ActiveSession | null> {
  try {
    return await requireUser();
  } catch {
    return null;
  }
}

export async function revokeSession(sessionId: string): Promise<void> {
  await connectDb();
  await Session.updateOne({ _id: sessionId }, { $set: { revokedAt: new Date() } });
}

export async function revokeAllUserSessions(userId: string, exceptSessionId?: string): Promise<number> {
  await connectDb();
  const res = await Session.updateMany(
    { userId, revokedAt: null, ...(exceptSessionId ? { _id: { $ne: exceptSessionId } } : {}) },
    { $set: { revokedAt: new Date() } }
  );
  return res.modifiedCount;
}
