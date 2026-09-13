import mongoose, { Schema, Types, Model, Document } from "mongoose";

export type AiPendingActionStatus = "pending" | "executing" | "executed" | "rejected" | "expired";

export interface AiPendingActionDoc extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  userId: Types.ObjectId;
  tool: "create_task" | "create_subtasks" | "update_task";
  args: Record<string, unknown>;
  status: AiPendingActionStatus;
  createdAt: Date;
  expiresAt: Date;
  executedAt?: Date | null;
  rejectedAt?: Date | null;
  result?: Record<string, unknown> | null;
  errorCode?: string | null;
}

const AiPendingActionSchema = new Schema<AiPendingActionDoc>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tool: { type: String, enum: ["create_task", "create_subtasks", "update_task"], required: true },
    args: { type: Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ["pending", "executing", "executed", "rejected", "expired"],
      default: "pending",
      index: true,
    },
    expiresAt: { type: Date, required: true },
    executedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    result: { type: Schema.Types.Mixed, default: null },
    errorCode: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// TTL-like index not auto-deleting, but we check expiry in logic. Keep index for cleanup queries.
// Optional TTL: expire documents 24h after expiry to keep collection small
AiPendingActionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 });

AiPendingActionSchema.index({ organizationId: 1, userId: 1, status: 1 });
AiPendingActionSchema.index({ organizationId: 1, userId: 1, createdAt: -1 });

export const AiPendingAction: Model<AiPendingActionDoc> =
  (mongoose.models.AiPendingAction as Model<AiPendingActionDoc>) ||
  mongoose.model<AiPendingActionDoc>("AiPendingAction", AiPendingActionSchema);
