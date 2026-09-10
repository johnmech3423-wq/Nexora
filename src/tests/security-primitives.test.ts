import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-auth-secret-for-nexora";
});

import { hashToken, createRandomToken, timingSafeEqual } from "@/server/security/tokens";
import { encryptSecret, decryptSecret } from "@/server/security/encryption";
import { signPayload, verifyPayload } from "@/server/security/signed";
import { generateTotpSecret, totpNow, verifyTotp, buildOtpauthUri } from "@/server/security/totp";
import { hashPassword, verifyPassword } from "@/server/security/password";

describe("security primitives", () => {
  it("creates URL-safe random tokens and hashes them deterministically", () => {
    const token = createRandomToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThan(30);
    expect(hashToken(token)).toHaveLength(64);
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).not.toBe(hashToken(`${token}x`));
  });

  it("compares token material safely without treating different values as equal", () => {
    expect(timingSafeEqual("same", "same")).toBe(true);
    expect(timingSafeEqual("same", "different")).toBe(false);
  });

  it("encrypts and authenticates secrets at rest", () => {
    const ciphertext = encryptSecret("totp-secret-value");
    expect(ciphertext).not.toContain("totp-secret-value");
    expect(decryptSecret(ciphertext)).toBe("totp-secret-value");

    const decoded = Buffer.from(ciphertext, "base64").toString("utf8");
    const payload = JSON.parse(decoded) as { iv: string; tag: string; data: string };
    payload.data = `${payload.data.slice(0, -2)}aa`;
    const tampered = Buffer.from(JSON.stringify(payload)).toString("base64");
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("rejects expired and tampered signed payloads", () => {
    const token = signPayload({ userId: "u1", purpose: "2fa" }, 60_000);
    expect(verifyPayload<{ userId: string }>(token)).toMatchObject({ userId: "u1" });

    const tampered = `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`;
    expect(verifyPayload(tampered)).toBeNull();

    const expired = signPayload({ userId: "u1" }, -1);
    expect(verifyPayload(expired)).toBeNull();
  });

  it("generates valid TOTP secrets and verifies current codes", () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    const at = 1_725_000_000_000;
    const code = totpNow(secret, at);
    expect(code).toMatch(/^\d{6}$/);
    expect(verifyTotp(secret, code, at)).toBe(true);
    expect(verifyTotp(secret, "000000", at)).toBe(code === "000000");
    expect(verifyTotp(secret, "12", at)).toBe(false);
    expect(buildOtpauthUri(secret, "user@example.com")).toContain("otpauth://totp/");
  });

  it("hashes passwords and never treats an incorrect password as valid", async () => {
    const hash = await hashPassword("Correct123");
    expect(hash).not.toBe("Correct123");
    expect(await verifyPassword("Correct123", hash)).toBe(true);
    expect(await verifyPassword("Wrong123", hash)).toBe(false);
  });
});
