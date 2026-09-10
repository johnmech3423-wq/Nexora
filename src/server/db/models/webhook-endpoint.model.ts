import { Schema, model, models, type Model } from "mongoose";

/** Any Nexora event a webhook endpoint may subscribe to. */
export const WEBHOOK_EVENTS = [
  "task.created",
  "task.updated",
  "task.deleted",
  "comment.created",
  "project.created",
  "project.updated",
  "project.deleted",
  "sprint.updated",
  "member.added",
  "member.removed",
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export interface WebhookEndpointDoc {
  organizationId: Schema.Types.ObjectId;
  url: string;
  /** per-endpoint secret used to sign payloads (HMAC-SHA256) */
  secret: string;
  events: WebhookEvent[];
  enabled: boolean;
  createdBy: Schema.Types.ObjectId;
  lastDeliveryAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const endpointSchema = new Schema<WebhookEndpointDoc>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    url: { type: String, required: true, maxlength: 2000 },
    secret: { type: String, required: true },
    events: { type: [String], default: [] },
    enabled: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    lastDeliveryAt: { type: Date, default: null },
  },
  { timestamps: true }
);

endpointSchema.index({ organizationId: 1, createdAt: -1 });

export const WebhookEndpoint: Model<WebhookEndpointDoc> =
  models.WebhookEndpoint ?? model<WebhookEndpointDoc>("WebhookEndpoint", endpointSchema);
