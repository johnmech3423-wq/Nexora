import { RateLimitBucket } from "@/server/db/models/rate-limit.model";
import { connectDb } from "@/server/db/db";
import { ApiError } from "@/server/errors";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Fixed-window-ish limiter backed by MongoDB, so limits are consistent
 * across serverless invocations. Windows reset every `windowMs`.
 * Only consults storage once per request.
 */
export async function rateLimit(
  scope: string,
  identifier: string,
  limit: number,
  windowMs: number,
  now = Date.now()
): Promise<RateLimitResult> {
  await connectDb();
  const key = `${scope}:${identifier}`;
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
  // `key` has a unique index, so an upsert must not race a row from a
  // previous window (E11000). Update in-window rows directly; when none
  // exists the window rolled over — clear the stale row, then insert.
  let bucket = await RateLimitBucket.findOneAndUpdate(
    { key, windowStart },
    { $inc: { count: 1 }, $set: { updatedAt: new Date(now) } },
    { new: true }
  );
  if (!bucket) {
    try {
      await RateLimitBucket.deleteMany({ key });
      bucket = await RateLimitBucket.findOneAndUpdate(
        { key, windowStart },
        { $inc: { count: 1 }, $set: { updatedAt: new Date(now) } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch {
      // Concurrent window rollover — retry once against the fresh row.
      bucket = await RateLimitBucket.findOneAndUpdate(
        { key, windowStart },
        { $inc: { count: 1 }, $set: { updatedAt: new Date(now) } },
        { new: true }
      );
    }
  }
  const count = bucket?.count ?? 1;
  const allowed = count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: Math.max(1, Math.ceil((windowStart.getTime() + windowMs - now) / 1000)),
  };
}

/** Convenience: throws ApiError(429) when over the limit. */
export async function assertRateLimit(
  scope: string,
  identifier: string,
  limit: number,
  windowMs: number,
  message = "Too many requests. Please try again later."
): Promise<void> {
  const result = await rateLimit(scope, identifier, limit, windowMs);
  if (!result.allowed) {
    throw ApiError.rateLimited(message);
  }
}

/** Default auth-endpoint budget: 10 / 15 min per (scope, ip-or-user). */
export const AUTH_RATE_LIMITS = {
  loginPerIp: { limit: 20, windowMs: 15 * 60_000 },
  loginPerUser: { limit: 10, windowMs: 15 * 60_000 },
  requestPerIp: { limit: 8, windowMs: 15 * 60_000 }, // password reset / verification / 2fa
  registerPerIp: { limit: 5, windowMs: 60 * 60_000 },
  sendPerIp: { limit: 30, windowMs: 60_000 }, // generic mutation guard (invite resend etc.)
} as const;

