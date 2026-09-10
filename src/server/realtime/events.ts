/* ------------------------------------------------------------------ */
/* Realtime event bus — Vercel-compatible.                             */
/*                                                                     */
/* Design: business logic publishes DOMAIN events here; transport is   */
/* pluggable (Pusher Channels-compatible via env; no-op "none" driver  */
/* in local dev means the app simply works without realtime).          */
/*                                                                     */
/* Server → client:                                                    */
/*   presence/org:{orgId}    → org-scoped events (tasks, chat…)        */
/*   presence/user:{userId}  → personal events (notifications)         */
/* Client → server: mutations ALWAYS go through REST APIs (persist +   */
/* replay-safe); realtime is only for fan-out.                         */
/* ------------------------------------------------------------------ */
import { env } from "@/lib/env";

export type RealtimeEventName =
  | "task.created"
  | "task.updated"
  | "task.moved"
  | "task.deleted"
  | "task.assigned"
  | "comment.created"
  | "comment.updated"
  | "comment.deleted"
  | "sprint.started"
  | "sprint.completed"
  | "milestone.updated"
  | "project.updated"
  | "member.joined"
  | "member.removed"
  | "member.updated"
  | "notification.created"
  | "message.created"
  | "message.updated"
  | "message.deleted"
  | "conversation.created"
  | "typing"
  | "presence"
  | "channel.updated";

export interface RealtimeEnvelope<T = unknown> {
  type: RealtimeEventName;
  organizationId?: string;
  data: T;
  at: string;
}

let pusherClient: { trigger: (channels: string[], event: string, data: unknown) => Promise<void> } | null = null;

function getPusher(): typeof pusherClient {
  if (pusherClient) return pusherClient;
  if (env.realtimeDriver !== "pusher") return null;
  const { appId, key, secret, cluster } = env.pusher;
  if (!appId || !key || !secret) {
    console.error("[realtime] PUSHER_* env incomplete — disabling realtime.");
    return null;
  }
  try {
    // Lazy require keeps the SDK out of the server bundle when unconfigured.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Pusher = require("pusher");
    pusherClient = new Pusher({ appId, key, secret, cluster, useTLS: true });
  } catch (error) {
    console.error("[realtime] pusher SDK missing — run `npm i pusher` to enable realtime:", error);
    pusherClient = null;
  }
  return pusherClient;
}

export function realtimeEnabled(): boolean {
  return getPusher() !== null;
}

/**
 * Fan a domain event out to org + affected users. Fire-and-forget:
 * failures are logged, never thrown (app must survive realtime down).
 */
export async function publish(
  channels: string[],
  event: RealtimeEventName,
  data: unknown
): Promise<void> {
  const envelope: RealtimeEnvelope = { type: event, data, at: new Date().toISOString() };
  try {
    const client = getPusher();
    if (!client) return; // no-op driver — local/dev mode
    await client.trigger(channels, event, envelope);
  } catch (error) {
    console.error("[realtime] publish failed:", error);
  }
}

export function orgChannel(organizationId: string): string {
  return `private-org-${organizationId}`;
}

export function userChannel(userId: string): string {
  return `private-user-${userId}`;
}

export function projectChannel(organizationId: string, projectId: string): string {
  return `private-org-${organizationId}-project-${projectId}`;
}

/**
 * Channel authorization used by the realtime subscription endpoint:
 * presence channels are private; the caller must prove org membership.
 * (Pusher calls /api/realtime/auth with socket_id + channel_name.)
 */
export async function assertChannelAuthorized(userId: string, channelName: string): Promise<boolean> {
  const match = /^private-(?:org|user)-([a-f0-9]{24})$/.exec(channelName);
  if (!match) return false;
  const orgId = match[1];
  if (channelName.startsWith("private-user-")) return orgId === userId;
  // private-org-<id> — verify an active membership.
  const { Membership } = await import("@/server/db/models/membership.model");
  const { connectDb } = await import("@/server/db/db");
  await connectDb();
  return Boolean(await Membership.exists({ organizationId: orgId, userId, status: "active" }));
}
