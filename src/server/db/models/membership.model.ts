import { Schema, model, models, type Model } from "mongoose";
import type { MemberStatus, OrgRole } from "@/lib/constants";

export interface MembershipDoc {
  organizationId: Schema.Types.ObjectId;
  userId: Schema.Types.ObjectId;
  role: OrgRole;
  status: MemberStatus;
  title: string | null;
  joinedAt: Date;
  lastActiveAt: Date | null;
  createdAt: Date;
}

const membershipSchema = new Schema<MembershipDoc>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["owner", "admin", "member", "guest"], required: true },
    status: { type: String, enum: ["active", "suspended"], default: "active" },
    title: { type: String, default: null, maxlength: 100 },
    joinedAt: { type: Date, default: Date.now },
    lastActiveAt: { type: Date, default: null },
  },
  { timestamps: true }
);

membershipSchema.index({ organizationId: 1, userId: 1 }, { unique: true });
membershipSchema.index({ userId: 1, role: 1 });
membershipSchema.index({ organizationId: 1, role: 1 });
membershipSchema.index({ organizationId: 1, status: 1 });

export const Membership: Model<MembershipDoc> = models.Membership ?? model<MembershipDoc>("Membership", membershipSchema);
