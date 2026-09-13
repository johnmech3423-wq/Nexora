import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Deterministic 32-byte key derived from AUTH_SECRET (HMAC-based so a
 * weak secret can never produce a weak key directly). Used to encrypt
 * small secrets at rest (TOTP seeds).
 */
function deriveKey(): Buffer {
  return createHash("sha256").update(`nexora:enc:v1:${env.authSecret()}`).digest();
}

export interface EncryptedPayload {
  iv: string; // base64
  tag: string; // base64 (GCM auth tag)
  data: string; // base64 ciphertext
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const payload: EncryptedPayload = {
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: enc.toString("base64"),
  };
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

export function decryptSecret(encoded: string): string {
  const raw = Buffer.from(encoded, "base64").toString("utf8");
  const payload = JSON.parse(raw) as EncryptedPayload;
  const decipher = createDecipheriv("aes-256-gcm", deriveKey(), Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  const dec = Buffer.concat([decipher.update(Buffer.from(payload.data, "base64")), decipher.final()]);
  return dec.toString("utf8");
}
