import { Schema, model, models, type Model } from "mongoose";
import type { ProjectRole } from "@/lib/permissions";

export interface ProjectMemberDoc {
  projectId: Schema.Types.ObjectId;
  userId: Schema.Types.ObjectId;
  role: ProjectRole;
  addedBy: Schema.Types.ObjectId;
  createdAt: Date;
}

const projectMemberSchema = new Schema<ProjectMemberDoc>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["manager", "member", "viewer"], required: true },
    addedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

projectMemberSchema.index({ projectId: 1, userId: 1 }, { unique: true });
projectMemberSchema.index({ userId: 1, role: 1 });

export const ProjectMember: Model<ProjectMemberDoc> =
  models.ProjectMember ?? model<ProjectMemberDoc>("ProjectMember", projectMemberSchema);
