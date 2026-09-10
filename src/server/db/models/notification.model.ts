import { Schema, model, models, type Model } from "mongoose";
import type { NotificationType } from "@/lib/constants";

export interface NotificationDoc {
  recipientId: Schema.Types.ObjectId;
  organizationId: Schema.Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string | null;
  actorId: Schema.Types.ObjectId | null;
  entityType: string;
  entityId: Schema.Types.ObjectId | null;
  projectId: Schema.Types.ObjectId | null;
  link: string | null;
  readAt: Date | null;
  createdAt: Date;
}

const notificationSchema = new Schema<NotificationDoc>(
  {
    recipientId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    type: { type: String, enum: ["mention", "task_assigned", "task_update", "comment", "invitation", "project_activity", "sprint_event", "chat_message", "deadline_reminder", "system"], required: true },
    title: { type: String, required: true, maxlength: 300 },
    body: { type: String, default: null, maxlength: 1000 },
    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    entityType: { type: String, required: true }, // task | project | ...
    entityId: { type: Schema.Types.ObjectId, default: null },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", default: null },
    link: { type: String, default: null, maxlength: 500 },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ recipientId: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, readAt: 1 });
notificationSchema.index({ entityType: 1, entityId: 1 });
// Auto-clean notifications older than 90 days.
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const Notification: Model<NotificationDoc> =
  models.Notification ?? model<NotificationDoc>("Notification", notificationSchema);
