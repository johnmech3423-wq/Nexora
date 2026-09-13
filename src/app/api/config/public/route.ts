import { handleApi, ok } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { getRuntimeConfig } from "@/server/services/platform-config.service";

export const runtime = "nodejs";

/** Authenticated, browser-safe runtime configuration. Never includes secrets. */
export const GET = handleApi(async () => {
  await requireUser();
  const cfg = await getRuntimeConfig();
  return ok({
    realtime: { driver: cfg.realtime.driver, key: cfg.realtime.key, cluster: cfg.realtime.cluster },
    platform: { name: cfg.platform.name, supportEmail: cfg.platform.supportEmail },
  });
});
