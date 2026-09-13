import type { NextRequest } from "next/server";
import { z } from "zod";
import { handleApi, ok, parseBody } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { requirePlatformAdmin } from "@/server/services/admin.service";
import { platformConfigStatus, updatePlatformConfig } from "@/server/services/platform-config.service";

export const runtime = "nodejs";

const bodySchema = z.object({
  admins: z.object({ emails: z.array(z.string().email().max(254)).max(20) }).optional(),
  storage: z.object({ driver: z.enum(["local", "cloudinary"]) }).optional(),
  smtp: z.object({
    host: z.string().max(255).optional(), port: z.number().int().min(1).max(65535).optional(), secure: z.boolean().optional(),
    user: z.string().max(255).optional(), pass: z.string().max(1000).optional(), clearPass: z.boolean().optional(), mailFrom: z.string().max(254).optional(),
  }).optional(),
  cloudinary: z.object({ cloudName: z.string().max(255).optional(), apiKey: z.string().max(255).optional(), apiSecret: z.string().max(1000).optional(), clearApiSecret: z.boolean().optional() }).optional(),
  ai: z.object({ provider: z.enum(["none", "openai-compatible", "anthropic"]).optional(), apiKey: z.string().max(1000).optional(), clearApiKey: z.boolean().optional(), baseUrl: z.string().max(500).optional(), model: z.string().max(200).optional() }).optional(),
  realtime: z.object({ driver: z.enum(["none", "pusher"]).optional(), appId: z.string().max(255).optional(), key: z.string().max(255).optional(), secret: z.string().max(1000).optional(), clearSecret: z.boolean().optional(), cluster: z.string().max(100).optional() }).optional(),
  platform: z.object({ name: z.string().min(2).max(80).optional(), supportEmail: z.string().email().max(254).optional(), maintenanceMode: z.boolean().optional(), allowRegistration: z.boolean().optional() }).optional(),
});

export const GET = handleApi(async () => {
  const session = await requireUser();
  await requirePlatformAdmin(session.user.email);
  return ok(await platformConfigStatus());
});

export const PUT = handleApi(async (req: NextRequest) => {
  const session = await requireUser();
  await requirePlatformAdmin(session.user.email);
  const body = await parseBody(req, bodySchema);
  await updatePlatformConfig(body, session.user.email);
  return ok(await platformConfigStatus());
});
