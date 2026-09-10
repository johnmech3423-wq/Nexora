import { Schema, model, models, type Model } from "mongoose";
import type { PlanKey } from "@/lib/constants";

export interface OrgSettings {
  /** new members may only see projects they are added to */
  restrictProjectVisibility: boolean;
  /** allow members to create projects (otherwise managers only) */
  allowMemberProjects: boolean;
  /** members can create channels */
  allowMemberChannels: boolean;
}

export interface OrgDoc {
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  logoFileId: Schema.Types.ObjectId | null;
  ownerUserId: Schema.Types.ObjectId;
  plan: {
    key: PlanKey;
    status: "active" | "trial" | "past_due" | "canceled";
    trialEndsAt: Date | null;
    renewalAt: Date | null;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    updatedAt: Date | null;
  };
  settings: OrgSettings;
  storageUsedBytes: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

const orgSchema = new Schema<OrgDoc>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    slug: { type: String, required: true, trim: true, lowercase: true, match: /^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$/ },
    description: { type: String, default: null, maxlength: 400 },
    logoUrl: { type: String, default: null },
    logoFileId: { type: Schema.Types.ObjectId, ref: "File", default: null },
    ownerUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    plan: {
      key: { type: String, enum: ["free", "pro", "business"], default: "free" },
      status: { type: String, enum: ["active", "trial", "past_due", "canceled"], default: "active" },
      trialEndsAt: { type: Date, default: null },
      renewalAt: { type: Date, default: null },
      stripeCustomerId: { type: String, default: null },
      stripeSubscriptionId: { type: String, default: null },
      updatedAt: { type: Date, default: null },
    },
    settings: {
      restrictProjectVisibility: { type: Boolean, default: false },
      allowMemberProjects: { type: Boolean, default: true },
      allowMemberChannels: { type: Boolean, default: true },
    },
    storageUsedBytes: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

orgSchema.index({ slug: 1 }, { unique: true });
orgSchema.index({ ownerUserId: 1 });
orgSchema.index({ deletedAt: 1 });

export const Organization: Model<OrgDoc> = models.Organization ?? model<OrgDoc>("Organization", orgSchema);
