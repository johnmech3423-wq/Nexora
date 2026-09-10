import { Schema, model, models, type Model } from "mongoose";
import type { InvitationStatus, OrgRole } from "@/lib/constants";

export interface InvitationDoc {
  organizationId: Schema.Types.ObjectId;
  email: string;
  role: OrgRole;
  invitedBy: Schema.Types.ObjectId;
  tokenHash: string;
  status: InvitationStatus;
  expiresAt: Date;
  invitedAt: Date;
  acceptedAt: Date | null;
  declinedAt: Date | null;
  revokedAt: Date | null;
  resendCount: number;
  lastSentAt: Date | null;
  joinedUserId: Schema.Types.ObjectId | null;
  createdAt: Date;
}

const invitationSchema = new Schema<InvitationDoc>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, enum: ["owner", "admin", "member", "guest"], required: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    tokenHash: { type: String, required: true, unique: true },
    status: { type: String, enum: ["pending", "accepted", "declined", "revoked", "expired"], default: "pending", index: true },
    expiresAt: { type: Date, required: true },
    invitedAt: { type: Date, default: Date.now },
    acceptedAt: { type: Date, default: null },
    declinedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    resendCount: { type: Number, default: 0 },
    lastSentAt: { type: Date, default: null },
    joinedUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

invitationSchema.index({ organizationId: 1, status: 1 });
invitationSchema.index({ organizationId: 1, email: 1, status: 1 });
invitationSchema.index({ email: 1, status: 1 });
// Physical TTL cleanup for old, resolved invitations.
invitationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const Invitation: Model<InvitationDoc> = models.Invitation ?? model<InvitationDoc>("Invitation", invitationSchema);
