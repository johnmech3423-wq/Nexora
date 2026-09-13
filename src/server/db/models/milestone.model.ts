import { Schema, model, models, type Model } from "mongoose";

export interface MilestoneDoc {
  organizationId: Schema.Types.ObjectId;
  projectId: Schema.Types.ObjectId;
  name: string;
  description: string | null;
  dueDate: Date | null;
  completedAt: Date | null;
  createdBy: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const milestoneSchema = new Schema<MilestoneDoc>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    description: { type: String, default: null, maxlength: 2000 },
    dueDate: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

milestoneSchema.index({ organizationId: 1, dueDate: 1 });
milestoneSchema.index({ projectId: 1, completedAt: 1 });

export const Milestone: Model<MilestoneDoc> = models.Milestone ?? model<MilestoneDoc>("Milestone", milestoneSchema);
