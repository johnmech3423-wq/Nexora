/* ------------------------------------------------------------------ */
/* Object-storage abstraction.                                         */
/*   STORAGE_DRIVER=local      → filesystem under storage/uploads      */
/*   STORAGE_DRIVER=cloudinary → Cloudinary Upload API (env keys)      */
/* Vercel: attach a writable filesystem (e.g. /tmp is per-invocation,  */
/* so for serverless production use a blob/CDN provider; the driver    */
/* interface keeps that swap to one file).                             */
/* ------------------------------------------------------------------ */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { env } from "@/lib/env";

export interface StoredObject {
  provider: "local" | "cloudinary";
  /** local: relative path under storage/uploads; cloudinary: public_id */
  storageKey: string;
  /** cloudinary secure URL; null for local (served by /api/files/:id/content) */
  url: string | null;
}

const LOCAL_ROOT = path.join(process.cwd(), "storage", "uploads");

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/csv": "csv",
  "text/markdown": "md",
  "application/json": "json",
  "application/zip": "zip",
};

function safeExtension(fileName: string, mime: string): string {
  const ext = path.extname(fileName).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
  const mapped = EXT_BY_MIME[mime];
  if (ext && (!mapped || mapped === ext)) return ext || mapped;
  return mapped || "bin";
}

export async function putBytes(input: {
  bytes: Buffer;
  fileName: string;
  mime: string;
  organizationId: string;
}): Promise<StoredObject> {
  const ext = safeExtension(input.fileName, input.mime);
  const base = `${crypto.randomBytes(12).toString("hex")}-${Date.now()}`;

  if (env.storageDriver === "cloudinary") {
    const cloudName = env.cloudinary.cloudName;
    const apiKey = env.cloudinary.apiKey;
    const apiSecret = env.cloudinary.apiSecret;
    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error("STORAGE_DRIVER=cloudinary requires CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET");
    }
    // Lazy require keeps the SDK out of local bundles.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const cloudinary = require("cloudinary").v2;
    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
    const folder = `nexora/${input.organizationId}`;
    const result = await cloudinary.uploader.upload(`data:${input.mime};base64,${input.bytes.toString("base64")}`, {
      folder,
      public_id: base,
      resource_type: "auto",
      overwrite: false,
    });
    return {
      provider: "cloudinary",
      storageKey: String(result.public_id),
      url: typeof result.secure_url === "string" ? result.secure_url : null,
    };
  }

  // Local driver.
  const storageKey = path.posix.join(input.organizationId, `${base}.${ext}`);
  const absolute = path.join(LOCAL_ROOT, storageKey);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, input.bytes, { flag: "wx" });
  return { provider: "local", storageKey, url: null };
}

export async function deleteObject(object: StoredObject): Promise<void> {
  try {
    if (object.provider === "cloudinary") {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const cloudinary = require("cloudinary").v2;
      const { cloudName, apiKey, apiSecret } = env.cloudinary;
      if (!cloudName || !apiKey || !apiSecret) return;
      cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
      await cloudinary.uploader.destroy(object.storageKey);
      return;
    }
    await fs.unlink(path.join(LOCAL_ROOT, object.storageKey));
  } catch {
    // Best-effort removal — orphaned objects are harmless and reaped by GC.
  }
}

/** True when bytes begin with the magic sequence for common image types (defense-in-depth MIME check). */
export function sniffMime(bytes: Buffer): string | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return "image/gif";
  const head = bytes.subarray(0, 1024).toString("utf8").trimStart();
  if (head.startsWith("<svg") || head.startsWith("<?xml")) return "image/svg+xml";
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "application/pdf";
  return null;
}
