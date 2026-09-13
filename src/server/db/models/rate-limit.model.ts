import { Schema, model, models, type Model } from "mongoose";

/**
 * Sliding-window rate-limit bucket, persisted so limits hold across
 * serverless instances (auth endpoints, invitation resends, search…).
 */
export interface RateLimitBucketDoc {
  /** e.g. "auth:login:ip:1.2.3.4" | "auth:login:user:507f…" */
  key: string;
  windowStart: Date;
  count: number;
  updatedAt: Date;
}

const bucketSchema = new Schema<RateLimitBucketDoc>(
  {
    key: { type: String, required: true, unique: true },
    windowStart: { type: Date, required: true },
    count: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Auto-remove stale buckets.
bucketSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 60 * 60 });

export const RateLimitBucket: Model<RateLimitBucketDoc> =
  models.RateLimitBucket ?? model<RateLimitBucketDoc>("RateLimitBucket", bucketSchema);
