import { Schema, model, models, type Model } from "mongoose";

export interface TimeEntryDoc {
  organizationId: Schema.Types.ObjectId;
  projectId: Schema.Types.ObjectId;
  taskId: Schema.Types.ObjectId;
  userId: Schema.Types.ObjectId;
  description: string | null;
  startAt: Date;
  endAt: Date | null; // null → running
  /** cached minutes so list queries don't compute per row */
  durationMs: number;
  source: "timer" | "manual";
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const timeEntrySchema = new Schema<TimeEntryDoc>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    description: { type: String, default: null, maxlength: 500 },
    startAt: { type: Date, required: true },
    endAt: { type: Date, default: null },
    durationMs: { type: Number, default: 0 },
    source: { type: String, enum: ["timer", "manual"], required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// One running timer per user (hard guarantee — see service for friendly errors).
timeEntrySchema.index({ userId: 1, endAt: 1 }, { unique: true, partialFilterExpression: { endAt: null } });
timeEntrySchema.index({ taskId: 1, deletedAt: 1 });
timeEntrySchema.index({ userId: 1, startAt: -1 });
timeEntrySchema.index({ organizationId: 1, projectId: 1, userId: 1 });

export const TimeEntry: Model<TimeEntryDoc> = models.TimeEntry ?? model<TimeEntryDoc>("TimeEntry", timeEntrySchema);
