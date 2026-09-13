import { Schema, model, models, type Model } from "mongoose";
import type { MessageType } from "@/lib/constants";

export interface MessageAttachment {
  fileId: string;
  name: string;
  mime: string;
  size: number;
  url: string;
}

export interface MessageReaction {
  emoji: string;
  userIds: Schema.Types.ObjectId[];
}

export interface MessageDoc {
  organizationId: Schema.Types.ObjectId;
  conversationId: Schema.Types.ObjectId;
  senderId: Schema.Types.ObjectId;
  type: MessageType;
  body: string;
  parentId: Schema.Types.ObjectId | null;
  mentions: Schema.Types.ObjectId[];
  attachments: MessageAttachment[];
  reactions: MessageReaction[];
  editedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<MessageDoc>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["text", "system"], default: "text" },
    body: { type: String, default: "", maxlength: 10_000 },
    parentId: { type: Schema.Types.ObjectId, ref: "Message", default: null },
    mentions: { type: [Schema.Types.ObjectId], default: [] },
    attachments: {
      type: [
        {
          _id: false,
          fileId: { type: String, required: true },
          name: { type: String, required: true },
          mime: { type: String, required: true },
          size: { type: Number, required: true },
          url: { type: String, required: true },
        },
      ],
      default: [],
    },
    reactions: {
      type: [
        {
          _id: false,
          emoji: { type: String, required: true },
          userIds: { type: [Schema.Types.ObjectId], default: [] },
        },
      ],
      default: [],
    },
    editedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ parentId: 1 });
messageSchema.index({ organizationId: 1, createdAt: -1 });
// Full-text search over message bodies (excludes soft-deleted via partial filter).
messageSchema.index({ body: "text" }, { name: "message_search", partialFilterExpression: { deletedAt: null } });

export const Message: Model<MessageDoc> = models.Message ?? model<MessageDoc>("Message", messageSchema);
