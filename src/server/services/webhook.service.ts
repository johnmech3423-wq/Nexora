/* ------------------------------------------------------------------ */
/* Outgoing webhooks — endpoints CRUD, HMAC-signed delivery, retries   */
/* with backoff, delivery log. Providers: none (local) works fine;     */
/* delivery is direct from the serverless function (documented).       */
/* ------------------------------------------------------------------ */
import crypto from "node:crypto";
import { ApiError } from "@/server/errors";
import { connectDb } from "@/server/db/db";
import { WebhookEndpoint } from "@/server/db/models/webhook-endpoint.model";
import { WebhookDelivery } from "@/server/db/models/webhook-delivery.model";
import { assertOrgPermission } from "@/server/authorization/guard";
import { assertPlanFeature } from "@/server/services/billing.service";
import { logActivity } from "@/server/services/activity.service";
import { env } from "@/lib/env";
import { PLAN_LIMITS, type PlanKey } from "@/lib/constants";
import { WEBHOOK_EVENT_KEYS, type WebhookEventKey } from "@/lib/constants";

export { WEBHOOK_EVENT_KEYS, type WebhookEventKey };

import type { WebhookEndpointDTO, WebhookDeliveryDTO } from "@/types";
import { Types } from "mongoose";


const toId = (s: string) => new Types.ObjectId(s);

export function generateSecret(): string {
  return crypto.randomBytes(24).toString("hex");
}

function signPayload(secret: string, timestamp: string, body: string): string {
  return crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

type EndpointLean = {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  url: string;
  secret: string;
  events: string[];
  enabled: boolean;
  createdBy: Types.ObjectId;
  lastDeliveryAt: Date | null;
  createdAt: Date;
};

export async function listEndpoints(actorUserId: string, orgIdOrSlug: string): Promise<WebhookEndpointDTO[]> {
  const ctx = await assertOrgPermission(actorUserId, orgIdOrSlug, "webhook.manage");
  await connectDb();
  const rows = (await WebhookEndpoint.find({ organizationId: toId(ctx.organizationId) })
    .sort({ createdAt: -1 })
    .lean()) as unknown as EndpointLean[];
  const deliveries = await WebhookDelivery.aggregate<{ _id: string; count: number; status: string; lastAt: Date }>([
    { $match: { organizationId: toId(ctx.organizationId) } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: "$endpointId", count: { $sum: 1 }, status: { $first: "$status" }, lastAt: { $first: "$createdAt" } } },
  ]);
  const byEndpoint = new Map(deliveries.map((d) => [String(d._id), d]));
  return rows.map((r) => {
    const d = byEndpoint.get(String(r._id));
    return {
      id: String(r._id),
      url: r.url,
      events: r.events,
      enabled: r.enabled,
      createdAt: new Date(r.createdAt).toISOString(),
      lastDeliveryAt: (d?.lastAt ?? r.lastDeliveryAt) ? new Date((d?.lastAt ?? r.lastDeliveryAt)!).toISOString() : null,
      lastStatus: d?.status ?? null,
      deliveryCount: d?.count ?? 0,
    };
  });
}

export async function createEndpoint(
  actorUserId: string,
  orgIdOrSlug: string,
  input: { url: string; events: WebhookEventKey[]; enabled?: boolean }
): Promise<WebhookEndpointDTO> {
  const ctx = await assertOrgPermission(actorUserId, orgIdOrSlug, "webhook.manage");
  await connectDb();
  await assertPlanFeature(ctx.organizationId, "webhooks");
  const org = await import("@/server/db/models/organization.model").then((m) =>
    m.Organization.findById(toId(ctx.organizationId)).select("plan").lean()
  );
  if (!org) throw ApiError.notFound("Organization not found.");
  const plan: PlanKey = org.plan.key;
  const maxEndpoints = PLAN_LIMITS[plan].webhooks;
  const existing = await WebhookEndpoint.countDocuments({ organizationId: toId(ctx.organizationId) });
  if (existing >= maxEndpoints) {
    throw new ApiError({
      status: 402,
      code: "plan_required",
      message: `Your plan allows ${maxEndpoints} webhook endpoint${maxEndpoints === 1 ? "" : "s"}.`,
      expose: true,
    });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(input.url);
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") throw new Error("protocol");
  } catch {
    throw ApiError.badRequest("Endpoint URL must be a valid http(s) URL.");
  }

  const uniqueEvents = [...new Set(input.events)];
  const invalid = uniqueEvents.filter((e) => !(WEBHOOK_EVENT_KEYS as readonly string[]).includes(e));
  if (invalid.length) throw ApiError.badRequest(`Unknown webhook event: ${invalid.join(", ")}`);

  const doc = await WebhookEndpoint.create({
    organizationId: toId(ctx.organizationId),
    url: parsedUrl.toString(),
    secret: generateSecret(),
    events: uniqueEvents,
    enabled: input.enabled !== false,
    createdBy: toId(actorUserId),
  });
  void logActivity({
    organizationId: ctx.organizationId,
    actorId: actorUserId,
    action: "webhook.create",
    entityType: "webhook",
    entityId: String(doc._id),
    metadata: { url: parsedUrl.origin, events: uniqueEvents.length },
  });
  const row = doc.toObject() as unknown as EndpointLean;
  return serializeEndpoint(row, null);
}

function serializeEndpoint(r: EndpointLean, d: { count: number; status: string; lastAt: Date } | null): WebhookEndpointDTO {
  return {
    id: String(r._id),
    url: r.url,
    events: r.events,
    enabled: r.enabled,
    createdAt: new Date(r.createdAt).toISOString(),
    lastDeliveryAt: (d?.lastAt ?? r.lastDeliveryAt) ? new Date((d?.lastAt ?? r.lastDeliveryAt)!).toISOString() : null,
    lastStatus: d?.status ?? null,
    deliveryCount: d?.count ?? 0,
  };
}

export async function updateEndpoint(
  actorUserId: string,
  orgIdOrSlug: string,
  endpointId: string,
  input: { url?: string; events?: WebhookEventKey[]; enabled?: boolean; rotateSecret?: boolean }
): Promise<WebhookEndpointDTO & { secret?: string }> {
  const ctx = await assertOrgPermission(actorUserId, orgIdOrSlug, "webhook.manage");
  await connectDb();
  const doc = await WebhookEndpoint.findOne({ _id: toId(endpointId), organizationId: toId(ctx.organizationId) });
  if (!doc) throw ApiError.notFound("Webhook endpoint not found.");

  const patch: Record<string, unknown> = {};
  if (input.url !== undefined) {
    try {
      const parsed = new URL(input.url);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("protocol");
      patch.url = parsed.toString();
    } catch {
      throw ApiError.badRequest("Endpoint URL must be a valid http(s) URL.");
    }
  }
  if (input.events !== undefined) {
    const uniqueEvents = [...new Set(input.events)];
    const invalid = uniqueEvents.filter((e) => !(WEBHOOK_EVENT_KEYS as readonly string[]).includes(e));
    if (invalid.length) throw ApiError.badRequest(`Unknown webhook event: ${invalid.join(", ")}`);
    patch.events = uniqueEvents;
  }
  if (input.enabled !== undefined) patch.enabled = input.enabled;
  if (input.rotateSecret) patch.secret = generateSecret();

  Object.assign(doc, patch);
  await doc.save();
  void logActivity({
    organizationId: ctx.organizationId,
    actorId: actorUserId,
    action: "webhook.update",
    entityType: "webhook",
    entityId: endpointId,
    metadata: { rotated: Boolean(input.rotateSecret) },
  });
  const row = doc.toObject() as unknown as EndpointLean;
  return { ...serializeEndpoint(row, null), ...(input.rotateSecret ? { secret: patch.secret as string } : {}) };
}

export async function deleteEndpoint(actorUserId: string, orgIdOrSlug: string, endpointId: string): Promise<void> {
  const ctx = await assertOrgPermission(actorUserId, orgIdOrSlug, "webhook.manage");
  await connectDb();
  const res = await WebhookEndpoint.deleteOne({ _id: toId(endpointId), organizationId: toId(ctx.organizationId) });
  if (!res.deletedCount) throw ApiError.notFound("Webhook endpoint not found.");
  await WebhookDelivery.updateMany({ endpointId: toId(endpointId) }, { $set: { status: "cancelled" } });
  void logActivity({
    organizationId: ctx.organizationId,
    actorId: actorUserId,
    action: "webhook.delete",
    entityType: "webhook",
    entityId: endpointId,
  });
}

export async function listDeliveries(
  actorUserId: string,
  orgIdOrSlug: string,
  opts: { page?: number; pageSize?: number; endpointId?: string } = {}
): Promise<{ items: WebhookDeliveryDTO[]; total: number; hasMore: boolean }> {
  const ctx = await assertOrgPermission(actorUserId, orgIdOrSlug, "webhook.manage");
  await connectDb();
  const page = opts.page ?? 1;
  const pageSize = Math.min(opts.pageSize ?? 20, 100);
  const match: Record<string, unknown> = { organizationId: toId(ctx.organizationId) };
  if (opts.endpointId) match.endpointId = toId(opts.endpointId);
  const [rows, total] = await Promise.all([
    WebhookDelivery.find(match).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    WebhookDelivery.countDocuments(match),
  ]);
  return {
    items: rows.map((d) => ({
      id: String(d._id),
      event: d.event,
      status: d.status,
      attempts: d.attempts,
      statusCode: d.statusCode,
      lastError: d.lastError,
      createdAt: new Date(d.createdAt).toISOString(),
    })),
    total,
    hasMore: page * pageSize < total,
  };
}

/** Fire a single delivery (used by retry + the direct dispatcher). */
async function executeDelivery(deliveryId: string): Promise<{ ok: boolean }> {
  await connectDb();
  const delivery = await WebhookDelivery.findById(toId(deliveryId));
  if (!delivery || delivery.status === "cancelled") return { ok: false };
  const endpoint = await WebhookEndpoint.findById(delivery.endpointId);
  if (!endpoint || !endpoint.enabled) {
    delivery.status = "cancelled";
    await delivery.save();
    return { ok: false };
  }

  const body = JSON.stringify({
    event: delivery.event,
    data: delivery.payload,
    sentAt: new Date().toISOString(),
  });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = signPayload(endpoint.secret, timestamp, body);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Nexora-Webhooks/1.0",
        "X-Nexora-Event": delivery.event,
        "X-Nexora-Delivery": String(delivery._id),
        "X-Nexora-Signature": `t=${timestamp},sha256=${signature}`,
      },
      body,
      signal: controller.signal,
    });
    delivery.attempts += 1;
    delivery.statusCode = res.status;
    delivery.lastError = res.ok ? null : `HTTP ${res.status}`;
    delivery.responseBody = (await res.text().catch(() => null))?.slice(0, 2000) ?? null;
    if (res.ok) {
      delivery.status = "success";
      delivery.nextAttemptAt = null;
    } else if (delivery.attempts >= delivery.maxAttempts) {
      delivery.status = "failed";
    } else {
      delivery.status = "pending";
      delivery.nextAttemptAt = new Date(Date.now() + 30_000 * Math.pow(2, Math.min(delivery.attempts, 6)));
    }
  } catch (error) {
    delivery.attempts += 1;
    delivery.lastError = error instanceof Error ? error.message.slice(0, 500) : "Network error";
    if (delivery.attempts >= delivery.maxAttempts) delivery.status = "failed";
    else {
      delivery.status = "pending";
      delivery.nextAttemptAt = new Date(Date.now() + 30_000 * Math.pow(2, Math.min(delivery.attempts, 6)));
    }
  } finally {
    clearTimeout(timer);
  }
  await delivery.save();
  if (delivery.status === "success" || delivery.status === "failed" || delivery.status === "pending") {
    await WebhookEndpoint.updateOne({ _id: endpoint._id }, { $set: { lastDeliveryAt: new Date() } });
  }
  return { ok: delivery.status === "success" };
}

export async function retryDelivery(
  actorUserId: string,
  orgIdOrSlug: string,
  deliveryId: string
): Promise<{ ok: boolean }> {
  const ctx = await assertOrgPermission(actorUserId, orgIdOrSlug, "webhook.manage");
  await connectDb();
  const delivery = await WebhookDelivery.findOne({ _id: toId(deliveryId), organizationId: toId(ctx.organizationId) }).lean();
  if (!delivery) throw ApiError.notFound("Delivery not found.");
  if (delivery.status === "success") throw ApiError.conflict("This delivery already succeeded.");
  await WebhookDelivery.updateOne({ _id: delivery._id }, { $set: { status: "pending", attempts: 0, nextAttemptAt: null } });
  const result = await executeDelivery(String(delivery._id));
  void logActivity({
    organizationId: ctx.organizationId,
    actorId: actorUserId,
    action: "webhook.retry",
    entityType: "webhook_delivery",
    entityId: deliveryId,
    metadata: { event: delivery.event },
  });
  return result;
}

/**
 * Fire-and-forget event dispatch to all matching enabled endpoints.
 * Called by services after mutations; never throws into business flow.
 */
export async function dispatchWebhookEvent(
  organizationId: string,
  event: WebhookEventKey,
  data: Record<string, unknown>
): Promise<void> {
  try {
    if (env.nodeEnv !== "production" && process.env.NEXORA_WEBHOOKS_LOCAL !== "1") return; // opt-in locally
    await connectDb();
    const endpoints = (await WebhookEndpoint.find({
      organizationId: toId(organizationId),
      enabled: true,
      events: event,
    }).lean()) as unknown as EndpointLean[];
    if (!endpoints.length) return;
    for (const endpoint of endpoints) {
      const delivery = await WebhookDelivery.create({
        endpointId: endpoint._id,
        organizationId: toId(organizationId),
        event,
        payload: data,
        status: "pending",
        attempts: 0,
        maxAttempts: 5,
      });
      await executeDelivery(String(delivery._id)).catch((error) =>
        console.error("[webhooks] immediate delivery failed:", error)
      );
    }
  } catch (error) {
    console.error("[webhooks] dispatch failed:", error);
  }
}

export const webhookSigningSecret = env.webhookSecret;
