import { Schema, model, models, type Model } from "mongoose";

export interface SessionDoc {
  tokenHash: string;
  userId: Schema.Types.ObjectId;
  userAgent: string;
  ip: string;
  createdAt: Date;
  lastActiveAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

const sessionSchema = new Schema<SessionDoc>(
  {
    tokenHash: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    userAgent: { type: String, default: "", maxlength: 512 },
    ip: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
    lastActiveAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: false }
);

sessionSchema.index({ userId: 1, createdAt: -1 });
// TTL cleanup of expired sessions (physical removal after expiry).
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session: Model<SessionDoc> = models.Session ?? model<SessionDoc>("Session", sessionSchema);
