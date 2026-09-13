import { Schema, model, models, type Model } from "mongoose";

export interface ConversationReadDoc {
  conversationId: Schema.Types.ObjectId;
  userId: Schema.Types.ObjectId;
  lastReadAt: Date;
  updatedAt: Date;
}

const readSchema = new Schema<ConversationReadDoc>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    lastReadAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

readSchema.index({ conversationId: 1, userId: 1 }, { unique: true });
readSchema.index({ userId: 1, lastReadAt: -1 });

export const ConversationRead: Model<ConversationReadDoc> =
  models.ConversationRead ?? model<ConversationReadDoc>("ConversationRead", readSchema);
