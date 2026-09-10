import { Schema, model, models, type Model } from "mongoose";

export interface ActivityLogDoc {
  organizationId: Schema.Types.ObjectId;
  actorId: Schema.Types.ObjectId | null;
  action: string;
  entityType: string | null;
  entityId: Schema.Types.ObjectId | null;
  projectId: Schema.Types.ObjectId | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  createdAt: Date;
}

const activitySchema = new Schema<ActivityLogDoc>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    action: { type: String, required: true },
    entityType: { type: String, default: null },
    entityId: { type: Schema.Types.ObjectId, default: null },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", default: null },
    metadata: { type: Schema.Types.Mixed, default: null },
    ip: { type: String, default: null },
  },
  { timestamps: true }
);

activitySchema.index({ organizationId: 1, createdAt: -1 });
activitySchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
activitySchema.index({ actorId: 1, createdAt: -1 });
activitySchema.index({ projectId: 1, createdAt: -1 });

export const ActivityLog: Model<ActivityLogDoc> =
  models.ActivityLog ?? model<ActivityLogDoc>("ActivityLog", activitySchema);
