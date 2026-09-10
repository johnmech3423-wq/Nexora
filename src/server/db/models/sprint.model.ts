import { Schema, model, models, type Model } from "mongoose";
import type { SprintStatus } from "@/lib/constants";

export interface SprintDoc {
  organizationId: Schema.Types.ObjectId;
  projectId: Schema.Types.ObjectId;
  name: string;
  goal: string | null;
  status: SprintStatus;
  startDate: Date | null;
  endDate: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  createdBy: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const sprintSchema = new Schema<SprintDoc>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    goal: { type: String, default: null, maxlength: 1000 },
    status: { type: String, enum: ["planned", "active", "completed", "cancelled"], default: "planned", index: true },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

sprintSchema.index({ projectId: 1, status: 1 });
sprintSchema.index({ projectId: 1, startDate: 1, endDate: 1 });

export const Sprint: Model<SprintDoc> = models.Sprint ?? model<SprintDoc>("Sprint", sprintSchema);
