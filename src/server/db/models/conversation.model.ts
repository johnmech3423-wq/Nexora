import { Schema, model, models, type Model } from "mongoose";
import type { ConversationType } from "@/lib/constants";

export interface ConversationDoc {
  organizationId: Schema.Types.ObjectId;
  type: ConversationType;
  name: string | null; // group/channel name
  projectId: Schema.Types.ObjectId | null; // for project_channel
  createdBy: Schema.Types.ObjectId;
  memberIds: Schema.Types.ObjectId[]; // dm + group only (channels derive from project members)
  /** sorted "a_b" of the two userIds for fast unique dm lookup */
  dmPairKey: string | null;
  lastMessageAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<ConversationDoc>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    type: { type: String, enum: ["dm", "group", "project_channel"], required: true },
    name: { type: String, default: null, maxlength: 120 },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    memberIds: { type: [Schema.Types.ObjectId], default: [] },
    dmPairKey: { type: String, default: null },
    lastMessageAt: { type: Date, default: null },
  },
  { timestamps: true }
);

conversationSchema.index({ dmPairKey: 1 }, { unique: true, partialFilterExpression: { type: "dm" } });
conversationSchema.index({ memberIds: 1, lastMessageAt: -1 });
conversationSchema.index({ projectId: 1 }, { unique: true, partialFilterExpression: { type: "project_channel" } });
conversationSchema.index({ organizationId: 1, lastMessageAt: -1 });

export const Conversation: Model<ConversationDoc> =
  models.Conversation ?? model<ConversationDoc>("Conversation", conversationSchema);
