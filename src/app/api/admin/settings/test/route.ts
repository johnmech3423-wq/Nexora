import type { NextRequest } from "next/server";
import { z } from "zod";
import { handleApi, ok, parseBody } from "@/server/api";
import { ApiError } from "@/server/errors";
import { requireUser } from "@/server/auth/session";
import { requirePlatformAdmin } from "@/server/services/admin.service";
import { testAiConfig, testCloudinaryConfig, testSmtpConfig } from "@/server/services/platform-config.service";

export const runtime = "nodejs";

const schema = z.object({ target: z.enum(["smtp", "cloudinary", "ai"]) });

export const POST = handleApi(async (req: NextRequest) => {
  const session = await requireUser();
  await requirePlatformAdmin(session.user.email);
  const { target } = await parseBody(req, schema);
  try {
    if (target === "smtp") await testSmtpConfig();
    else if (target === "cloudinary") await testCloudinaryConfig();
    else await testAiConfig();
    return ok({ target, ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connection test failed.";
    throw ApiError.badRequest(message.slice(0, 240));
  }
});
