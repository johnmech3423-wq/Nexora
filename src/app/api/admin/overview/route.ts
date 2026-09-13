import type { NextRequest } from "next/server";
import { handleApi, ok } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { platformOverview, requirePlatformAdmin } from "@/server/services/admin.service";

export const runtime = "nodejs";

/** GET /api/admin/overview — platform-wide stats (admin allowlist only). */
export const GET = handleApi(async () => {
  const session = await requireUser();
  await requirePlatformAdmin(session.user.email);
  const overview = await platformOverview();
  return ok(overview);
});

export const POST = handleApi(async (_req: NextRequest) => {
  const session = await requireUser();
  void session;
  return ok({ ok: true });
});
