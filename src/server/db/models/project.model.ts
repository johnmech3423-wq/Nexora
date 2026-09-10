import { Schema, model, models, type Model } from "mongoose";

export interface ProjectStatusSetting {
  key: string;
  label: string;
  color: string;
  index: number;
}

export interface ProjectLabelDef {
  id: string;
  name: string;
  color: string;
}

export interface ProjectDoc {
  organizationId: Schema.Types.ObjectId;
  name: string;
  /** human short code shown in task keys, e.g. "NEX" */
  key: string;
  description: string | null;
  color: string | null;
  ownerUserId: Schema.Types.ObjectId | null;
  statuses: ProjectStatusSetting[];
  labels: ProjectLabelDef[];
  startDate: Date | null;
  dueDate: Date | null;
  archivedAt: Date | null;
  archivedBy: Schema.Types.ObjectId | null;
  deletedAt: Date | null;
  createdBy: Schema.Types.ObjectId;
  settings: {
    /** when true only members see this project (default: all org members see it) */
    private: boolean;
    /** board shows non-terminal columns first; done always last column */
    hideDoneFromBoard?: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<ProjectDoc>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    key: { type: String, required: true, trim: true, uppercase: true, match: /^[A-Z][A-Z0-9]{1,7}$/ },
    description: { type: String, default: null, maxlength: 4000 },
    color: { type: String, default: null },
    ownerUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    statuses: {
      type: [
        {
          key: { type: String, required: true },
          label: { type: String, required: true, maxlength: 40 },
          color: { type: String, required: true },
          index: { type: Number, required: true },
        },
      ],
      default: [],
    },
    labels: {
      type: [
        {
          id: { type: String, required: true },
          name: { type: String, required: true, maxlength: 30 },
          color: { type: String, required: true },
        },
      ],
      default: [],
    },
    startDate: { type: Date, default: null },
    dueDate: { type: Date, default: null },
    archivedAt: { type: Date, default: null },
    archivedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    deletedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    settings: {
      private: { type: Boolean, default: false },
      hideDoneFromBoard: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

projectSchema.index({ organizationId: 1, key: 1 }, { unique: true });
projectSchema.index({ organizationId: 1, deletedAt: 1, archivedAt: 1 });
projectSchema.index({ organizationId: 1, dueDate: 1 });
// Full-text search for projects (name/key/description).
projectSchema.index(
  { name: "text", description: "text", key: "text" },
  { weights: { name: 10, key: 8, description: 3 }, name: "project_search" }
);

export const Project: Model<ProjectDoc> = models.Project ?? model<ProjectDoc>("Project", projectSchema);
