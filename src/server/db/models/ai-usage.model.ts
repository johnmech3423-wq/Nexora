import { Schema, model, models, type Model } from "mongoose";

export interface AiUsageDoc {
  organizationId: Schema.Types.ObjectId;
  userId: Schema.Types.ObjectId;
  provider: string;
  feature: string;
  ok: boolean;
  errorCode: string | null;
  promptChars: number;
  completionChars: number;
  createdAt: Date;
}

const aiUsageSchema = new Schema<AiUsageDoc>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    provider: { type: String, required: true },
    feature: { type: String, required: true },
    ok: { type: Boolean, default: true },
    errorCode: { type: String, default: null },
    promptChars: { type: Number, default: 0 },
    completionChars: { type: Number, default: 0 },
  },
  { timestamps: true }
);

aiUsageSchema.index({ userId: 1, createdAt: -1 });
aiUsageSchema.index({ organizationId: 1, createdAt: -1 });
// Rolling quota window cleanup.
aiUsageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2 * 24 * 60 * 60 });

export const AiUsage: Model<AiUsageDoc> = models.AiUsage ?? model<AiUsageDoc>("AiUsage", aiUsageSchema);
