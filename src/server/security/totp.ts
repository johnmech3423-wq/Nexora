import { createHmac } from "node:crypto";

/**
 * Minimal RFC 6238 TOTP (HMAC-SHA1, 30s step, 6 digits) — enough to
 * interoperate with Google Authenticator / 1Password / Authy without
 * pulling in a dependency.
 */

const STEP_MS = 30_000;
const DIGITS = 6;
const WINDOW = 1; // ±1 step tolerance on verify

export function generateTotpSecret(): string {
  // base32 alphabet; 20 bytes → 32 chars.
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < bytes.length; i += 5) {
    const buf = new Uint8Array(8);
    buf.set(bytes.slice(i, i + 5));
    const view = new DataView(buf.buffer);
    const num = view.getBigUint64(0, false);
    for (let j = 0; j < 8; j++) out += alphabet[Number((num >> BigInt(5 * j)) & 31n)];
  }
  return out.slice(0, 32);
}

function hmacSha1(key: Uint8Array, message: Buffer): Buffer {
  return createHmac("sha1", Buffer.from(key)).update(message).digest();
}

function hotp(secretBase32: string, counter: bigint): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits: number[] = [];
  for (const c of secretBase32.toUpperCase().replace(/=+$/, "")) {
    const idx = alphabet.indexOf(c);
    if (idx === -1) throw new Error("Invalid base32 secret");
    for (let b = 4; b >= 0; b--) bits.push((idx >> b) & 1);
  }
  const key = new Uint8Array(Math.ceil(bits.length / 8));
  bits.forEach((bit, i) => {
    key[Math.floor(i / 8)] = (key[Math.floor(i / 8)]! << 1) | bit;
  });

  const msg = Buffer.alloc(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) {
    msg[i] = Number(c & 0xffn);
    c >>= 8n;
  }
  const hash = hmacSha1(key, msg);
  const offset = hash[hash.length - 1]! & 0x0f;
  const code =
    ((hash[offset]! & 0x7f) << 24) | ((hash[offset + 1]! & 0xff) << 16) | ((hash[offset + 2]! & 0xff) << 8) | (hash[offset + 3]! & 0xff);
  return (code % 10 ** DIGITS).toString().padStart(DIGITS, "0");
}

export function totpNow(secretBase32: string, at = Date.now()): string {
  const counter = BigInt(Math.floor(at / STEP_MS));
  return hotp(secretBase32, counter);
}

export function verifyTotp(secretBase32: string, code: string, at = Date.now()): boolean {
  const clean = code.trim().replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return false;
  const counter = Math.floor(at / STEP_MS);
  for (let offset = -WINDOW; offset <= WINDOW; offset++) {
    if (hotp(secretBase32, BigInt(counter + offset)) === clean) return true;
  }
  return false;
}

/** otpauth:// URI for authenticator apps (also rendered as a code). */
export function buildOtpauthUri(secret: string, account: string, issuer = "Nexora"): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
