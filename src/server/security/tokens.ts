import { createHash, randomBytes } from "node:crypto";

/** Returns a URL-safe random token (32 bytes → 43 chars). */
export function createRandomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Constant-time token hash for storage (never persist raw tokens). */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function timingSafeEqual(a: string, b: string): boolean {
  const ah = createHash("sha256").update(a).digest();
  const bh = createHash("sha256").update(b).digest();
  return ah.equals(bh);
}
