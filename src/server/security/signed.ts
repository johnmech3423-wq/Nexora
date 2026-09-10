import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Stateless signed payloads (HMAC-SHA256, AUTH_SECRET). Used for
 * short-lived challenges (2FA step-up) where a DB round-trip is
 * unnecessary. Payloads are NOT encrypted — never put secrets inside.
 */
interface SignedEnvelope {
  p: string; // base64url(json payload)
  s: string; // hex HMAC
}

function sign(data: string): string {
  return createHmac("sha256", `nexora:signed:${env.authSecret()}`).update(data).digest("hex");
}

export function signPayload(payload: unknown, ttlMs: number): string {
  const body = JSON.stringify({ ...(payload as Record<string, unknown>), exp: Date.now() + ttlMs });
  const p = Buffer.from(body).toString("base64url");
  return Buffer.from(JSON.stringify({ p, s: sign(p) } as SignedEnvelope)).toString("base64url");
}

/** Returns payload or null when invalid/expired/tampered. */
export function verifyPayload<T>(token: string, maxAgeMs?: number): T | null {
  try {
    const envelope = JSON.parse(Buffer.from(token, "base64url").toString("utf8")) as SignedEnvelope;
    const expected = sign(envelope.p);
    const sig = Buffer.from(envelope.s, "hex");
    const expSig = Buffer.from(expected, "hex");
    if (sig.length !== expSig.length || !timingSafeEqual(sig, expSig)) return null;

    const payload = JSON.parse(Buffer.from(envelope.p, "base64url").toString("utf8")) as T & { exp?: number };
    if (!payload.exp || payload.exp < Date.now()) return null;
    if (maxAgeMs && payload.exp - Date.now() > maxAgeMs) return null;
    return payload as T;
  } catch {
    return null;
  }
}
