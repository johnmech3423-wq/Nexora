import { connectDb } from "@/server/db/db";
import { User } from "@/server/db/models/user.model";
import { Session } from "@/server/db/models/session.model";
import { ApiError } from "@/server/errors";
import { hashPassword, verifyPassword } from "@/server/security/password";
import { hashToken, createRandomToken } from "@/server/security/tokens";
import { encryptSecret, decryptSecret } from "@/server/security/encryption";
import { signPayload, verifyPayload } from "@/server/security/signed";
import { generateTotpSecret, verifyTotp, buildOtpauthUri } from "@/server/security/totp";
import { sendMail, appLink } from "@/server/email/mailer";
import { emailVerifyTemplate, passwordResetTemplate } from "@/server/email/templates";
import { env } from "@/lib/env";
import { createSession, revokeAllUserSessions, revokeSession } from "@/server/auth/session";
import { logActivity } from "@/server/services/activity.service";
import { rateLimit } from "@/server/security/rate-limit";

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 30 * 60 * 1000;
const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const CHALLENGE_MAX_AGE_MS = 15 * 60 * 1000;

export interface AuthMeta {
  ip: string;
  userAgent: string;
}

export interface LoginOutcome {
  status: "ok" | "needs_two_factor";
  sessionToken?: string;
  challenge?: string;
  expiresAt?: Date;
}

function sessionExpiry(remember?: boolean): Date {
  return new Date(Date.now() + (remember ? 30 : 7) * 24 * 60 * 60 * 1000);
}

/* ------------------------------------------------------------------ */
/* Registration / verification                                         */
/* ------------------------------------------------------------------ */

export async function registerUser(
  input: { name: string; email: string; password: string; remember?: boolean },
  meta: AuthMeta
): Promise<LoginOutcome> {
  await connectDb();
  const email = input.email.toLowerCase().trim();

  const existing = await User.exists({ email });
  if (existing) {
    throw ApiError.conflict("An account with this email already exists.");
  }

  const user = await User.create({
    email,
    name: input.name,
    passwordHash: await hashPassword(input.password),
    authProvider: "email",
    emailVerifiedAt: env.autoVerify ? new Date() : null,
  });

  if (!env.autoVerify) {
    const rawToken = createRandomToken(24);
    user.verificationTokenHash = hashToken(rawToken);
    user.verificationTokenExpiresAt = new Date(Date.now() + VERIFY_TTL_MS);
    await user.save();
    const link = appLink(`/verify-email?token=${encodeURIComponent(rawToken)}`);
    const mail = emailVerifyTemplate(user.name, link);
    void sendMail({ to: user.email, subject: mail.subject, html: mail.html, text: mail.text });
  }

  const sessionToken = await createSession({
    userId: user._id.toString(),
    userAgent: meta.userAgent,
    ip: meta.ip,
    remember: input.remember,
  });

  void logActivity({
    organizationId: null,
    action: "auth.register",
    actorId: user._id.toString(),
    ip: meta.ip,
  });
  void User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });

  return { status: "ok", sessionToken, expiresAt: sessionExpiry(input.remember) };
}

export async function verifyEmail(rawToken: string): Promise<void> {
  await connectDb();
  const user = await User.findOne({ verificationTokenHash: hashToken(rawToken) });
  if (!user) {
    throw ApiError.badRequest("This verification link is invalid or has expired. Request a new one.");
  }
  if (user.verificationTokenExpiresAt && user.verificationTokenExpiresAt.getTime() < Date.now()) {
    throw ApiError.badRequest("This verification link has expired. Request a new one.");
  }
  user.emailVerifiedAt = new Date();
  user.verificationTokenHash = null;
  user.verificationTokenExpiresAt = null;
  await user.save();
  void logActivity({ organizationId: null, action: "auth.verify_email", actorId: user._id.toString() });
}

export async function resendVerification(userId: string): Promise<void> {
  await connectDb();
  const user = await User.findById(userId);
  if (!user || user.deletedAt || user.emailVerifiedAt) return;
  await rateLimit("resend-verify", `user:${userId}`, 3, 60 * 60_000);
  const rawToken = createRandomToken(24);
  user.verificationTokenHash = hashToken(rawToken);
  user.verificationTokenExpiresAt = new Date(Date.now() + VERIFY_TTL_MS);
  await user.save();
  const link = appLink(`/verify-email?token=${encodeURIComponent(rawToken)}`);
  const mail = emailVerifyTemplate(user.name, link);
  await sendMail({ to: user.email, subject: mail.subject, html: mail.html, text: mail.text });
}

/* ------------------------------------------------------------------ */
/* Login / logout                                                      */
/* ------------------------------------------------------------------ */

export async function loginWithPassword(
  input: { email: string; password: string; remember?: boolean },
  meta: AuthMeta
): Promise<LoginOutcome> {
  await connectDb();
  const email = input.email.toLowerCase().trim();

  const [ipLimit, userLimit] = await Promise.all([
    rateLimit("login:ip", meta.ip, 20, 15 * 60_000),
    rateLimit("login:user", `email:${email}`, 10, 15 * 60_000),
  ]);
  if (!ipLimit.allowed || !userLimit.allowed) {
    throw ApiError.rateLimited("Too many sign-in attempts. Try again in a few minutes.");
  }

  const user = await User.findOne({ email }).where("deletedAt").equals(null);
  const passwordOk = user?.passwordHash ? await verifyPassword(input.password, user.passwordHash) : false;

  if (!user || !passwordOk) {
    await sleep(350);
    throw ApiError.unauthorized("Incorrect email or password.");
  }

  if (user.twoFactor.enabled) {
    const challenge = signPayload({ uid: user._id.toString(), purpose: "2fa-login" }, CHALLENGE_TTL_MS);
    return { status: "needs_two_factor", challenge };
  }

  const sessionToken = await createSession({
    userId: user._id.toString(),
    userAgent: meta.userAgent,
    ip: meta.ip,
    remember: input.remember,
  });
  await postLoginSuccess(user._id.toString(), meta);
  return { status: "ok", sessionToken, expiresAt: sessionExpiry(input.remember) };
}

export async function completeTwoFactorLogin(input: { code: string; challenge: string }, meta: AuthMeta): Promise<LoginOutcome> {
  await connectDb();
  const payload = verifyPayload<{ uid: string; purpose: string }>(input.challenge, CHALLENGE_MAX_AGE_MS);
  if (!payload || payload.purpose !== "2fa-login") {
    throw ApiError.badRequest("This sign-in request expired. Please start again.");
  }

  const user = await User.findById(payload.uid).where("deletedAt").equals(null);
  if (!user || !user.twoFactor.enabled || !user.twoFactor.secretEncrypted) {
    throw ApiError.badRequest("This sign-in request is no longer valid. Please start again.");
  }

  const limit = await rateLimit("2fa:user", user._id.toString(), 8, 15 * 60_000);
  if (!limit.allowed) throw ApiError.rateLimited("Too many incorrect codes. Try again later.");

  if (!verifyTotp(decryptSecret(user.twoFactor.secretEncrypted), input.code)) {
    throw ApiError.unauthorized("That code is incorrect or expired.");
  }

  const sessionToken = await createSession({ userId: user._id.toString(), userAgent: meta.userAgent, ip: meta.ip });
  await postLoginSuccess(user._id.toString(), meta);
  return { status: "ok", sessionToken, expiresAt: sessionExpiry(false) };
}

async function postLoginSuccess(userId: string, meta: AuthMeta): Promise<void> {
  void User.updateOne({ _id: userId }, { $set: { lastLoginAt: new Date() } });
  void logActivity({
    organizationId: null,
    action: "auth.login",
    actorId: userId,
    ip: meta.ip,
    metadata: { ua: meta.userAgent.slice(0, 200) },
  });
}

export async function logout(sessionId: string, actorId: string): Promise<void> {
  await revokeSession(sessionId);
  void logActivity({ organizationId: null, action: "auth.logout", actorId });
}

/* ------------------------------------------------------------------ */
/* Password flows                                                      */
/* ------------------------------------------------------------------ */

export async function requestPasswordReset(email: string, meta: AuthMeta): Promise<void> {
  await connectDb();
  await rateLimit("reset:ip", meta.ip, 8, 15 * 60_000);
  const user = await User.findOne({ email: email.toLowerCase().trim() }).where("deletedAt").equals(null);
  if (!user?.passwordHash) return; // generic success either way (anti-enumeration)

  const limit = await rateLimit("reset:user", user._id.toString(), 5, 15 * 60_000);
  if (!limit.allowed) return;

  const rawToken = createRandomToken(24);
  user.resetTokenHash = hashToken(rawToken);
  user.resetTokenExpiresAt = new Date(Date.now() + RESET_TTL_MS);
  await user.save();

  const link = appLink(`/reset-password?token=${encodeURIComponent(rawToken)}`);
  const mail = passwordResetTemplate(user.name, link);
  await sendMail({ to: user.email, subject: mail.subject, html: mail.html, text: mail.text });
}

export async function resetPassword(rawToken: string, newPassword: string): Promise<void> {
  await connectDb();
  const user = await User.findOne({ resetTokenHash: hashToken(rawToken) });
  if (!user || !user.resetTokenExpiresAt || user.resetTokenExpiresAt.getTime() < Date.now()) {
    throw ApiError.badRequest("This reset link is invalid or has expired. Request a new one.");
  }
  user.passwordHash = await hashPassword(newPassword);
  user.resetTokenHash = null;
  user.resetTokenExpiresAt = null;
  user.passwordChangedAt = new Date();
  await user.save();
  await revokeAllUserSessions(user._id.toString());
  void logActivity({ organizationId: null, action: "auth.reset_password", actorId: user._id.toString() });
}

export async function changePassword(
  userId: string,
  input: { currentPassword: string; newPassword: string },
  currentSessionId: string,
  revokeOthers = true
): Promise<void> {
  await connectDb();
  const user = await User.findById(userId);
  if (!user || user.deletedAt) throw ApiError.unauthorized();
  if (!user.passwordHash) {
    throw ApiError.conflict("This account has no password yet. Request a password reset to set one.");
  }
  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw ApiError.forbidden("Your current password is incorrect.");
  }

  user.passwordHash = await hashPassword(input.newPassword);
  user.passwordChangedAt = new Date();
  await user.save();

  if (revokeOthers) {
    await revokeAllUserSessions(userId, currentSessionId);
  }
  void logActivity({ organizationId: null, action: "user.password_changed", actorId: userId });
}

/* ------------------------------------------------------------------ */
/* Two-factor (TOTP)                                                   */
/* ------------------------------------------------------------------ */

export function provisionTwoFactor(accountEmail: string): { secret: string; otpauthUrl: string } {
  const secret = generateTotpSecret();
  return { secret, otpauthUrl: buildOtpauthUri(secret, accountEmail) };
}

export async function enableTwoFactor(userId: string, secret: string, code: string): Promise<void> {
  await connectDb();
  if (!verifyTotp(secret, code)) {
    throw ApiError.badRequest("That code doesn't match. Check the time on your device and try again.");
  }
  const user = await User.findById(userId);
  if (!user) throw ApiError.unauthorized();
  user.twoFactor = { enabled: true, secretEncrypted: encryptSecret(secret) };
  await user.save();
  // Sign out every other session when 2FA turns on (security best practice).
  await revokeAllUserSessions(userId);
  void logActivity({ organizationId: null, action: "auth.two_factor_enabled", actorId: userId });
}

export async function disableTwoFactor(userId: string, code: string): Promise<void> {
  await connectDb();
  const user = await User.findById(userId);
  if (!user?.twoFactor.secretEncrypted) throw ApiError.badRequest("Two-factor authentication is not enabled.");
  if (!verifyTotp(decryptSecret(user.twoFactor.secretEncrypted), code)) {
    throw ApiError.badRequest("That code is incorrect or expired.");
  }
  user.twoFactor = { enabled: false, secretEncrypted: null };
  await user.save();
  void logActivity({ organizationId: null, action: "auth.two_factor_disabled", actorId: userId });
}

/* ------------------------------------------------------------------ */
/* Session management                                                  */
/* ------------------------------------------------------------------ */

export interface SessionRecord {
  id: string;
  userAgent: string;
  ip: string;
  createdAt: Date;
  lastActiveAt: Date;
  expiresAt: Date;
}

export async function listSessions(userId: string): Promise<SessionRecord[]> {
  await connectDb();
  const sessions = await Session.find({ userId, revokedAt: null, expiresAt: { $gt: new Date() } })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  return sessions.map((s) => ({
    id: String(s._id),
    userAgent: s.userAgent,
    ip: s.ip,
    createdAt: s.createdAt,
    lastActiveAt: s.lastActiveAt,
    expiresAt: s.expiresAt,
  }));
}

export async function revokeOtherSessions(userId: string, exceptSessionId: string): Promise<number> {
  const res = await revokeAllUserSessions(userId, exceptSessionId);
  void logActivity({ organizationId: null, action: "session.revoked", actorId: userId });
  return res;
}

export async function revokeOneSession(userId: string, sessionId: string): Promise<void> {
  await connectDb();
  const session = await Session.findOne({ _id: sessionId, userId });
  if (!session) throw ApiError.notFound("That session no longer exists.");
  await revokeSession(sessionId);
  void logActivity({ organizationId: null, action: "session.revoked", actorId: userId, entityType: "session", entityId: sessionId });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
