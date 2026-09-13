import type { NextRequest } from "next/server";
import { handleApi, ok, fail } from "@/server/api";
import { ApiError } from "@/server/errors";
import { requireUser } from "@/server/auth/session";
import { assertChannelAuthorized } from "@/server/realtime/events";
import { getRuntimeConfig } from "@/server/services/platform-config.service";

export const runtime = "nodejs";

/**
 * POST /api/realtime/auth  { socket_id, channel_name }
 * Pusher-style private-channel authorization. Verifies the session and
 * that the user is a member of the org / owner of the user channel.
 * Returns { auth: "key:signature" } when the pusher driver is enabled.
 */
export const POST = handleApi(async (req: NextRequest) => {
  const session = await requireUser();
  const runtime = await getRuntimeConfig();
  if (runtime.realtime.driver !== "pusher") {
    throw ApiError.conflict("Realtime is not enabled on this deployment.");
  }
  let body: { socket_id?: string; channel_name?: string };
  try {
    body = (await req.json()) as { socket_id?: string; channel_name?: string };
  } catch {
    throw ApiError.badRequest("Invalid JSON body.");
  }
  const socketId = body.socket_id;
  const channelName = body.channel_name;
  if (!socketId || !channelName) {
    throw ApiError.badRequest("socket_id and channel_name are required.");
  }
  const allowed = await assertChannelAuthorized(String(session.user._id), channelName);
  if (!allowed) throw ApiError.forbidden("You are not allowed to subscribe to this channel.");

  try {
    // Lazy require keeps the SDK out of the bundle when unconfigured.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Pusher = require("pusher");
    const { appId, key, secret, cluster } = runtime.realtime;
    if (!appId || !key || !secret) throw new Error("incomplete pusher config");
    const pusher = new Pusher({ appId, key, secret, cluster, useTLS: true });
    const result = (await pusher.authorizeChannel(socketId, channelName)) as { auth: string };
    return ok({ auth: result.auth });
  } catch (error) {
    console.error("[realtime/auth] authorize failed:", error);
    return fail(ApiError.internal("Realtime authorization failed."));
  }
});
