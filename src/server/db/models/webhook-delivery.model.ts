import { Schema, model, models, type Model } from "mongoose";

export type DeliveryStatus = "pending" | "success" | "failed" | "cancelled";

export interface WebhookDeliveryDoc {
  endpointId: Schema.Types.ObjectId;
  organizationId: Schema.Types.ObjectId;
  event: string;
  payload: unknown;
  status: DeliveryStatus;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: Date | null;
  statusCode: number | null;
  lastError: string | null;
  responseBody: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const deliverySchema = new Schema<WebhookDeliveryDoc>(
  {
    endpointId: { type: Schema.Types.ObjectId, ref: "WebhookEndpoint", required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    event: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    status: { type: String, enum: ["pending", "success", "failed", "cancelled"], default: "pending", index: true },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    nextAttemptAt: { type: Date, default: null, index: true },
    statusCode: { type: Number, default: null },
    lastError: { type: String, default: null },
    responseBody: { type: String, default: null },
  },
  { timestamps: true }
);

deliverySchema.index({ endpointId: 1, createdAt: -1 });
deliverySchema.index({ organizationId: 1, status: 1 });

export const WebhookDelivery: Model<WebhookDeliveryDoc> =
  models.WebhookDelivery ?? model<WebhookDeliveryDoc>("WebhookDelivery", deliverySchema);
