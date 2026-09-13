import { Schema, model, models, type Model } from "mongoose";

export interface TaskLabelRef {
  id: string;
  name: string;
  color: string;
}

export interface TaskDoc {
  organizationId: Schema.Types.ObjectId;
  projectId: Schema.Types.ObjectId;
  /** sequential number within project → human key "<PROJECTKEY>-<number>" */
  number: number;
  title: string;
  description: string;
  status: string;
  priority: "none" | "low" | "medium" | "high" | "urgent";
  assigneeId: Schema.Types.ObjectId | null;
  reporterId: Schema.Types.ObjectId;
  dueDate: Date | null;
  startDate: Date | null;
  estimateMin: number | null;
  labels: TaskLabelRef[];
  /** ordering value inside (projectId, status). Lexicographic fractional ordering. */
  order: number;
  parentId: Schema.Types.ObjectId | null;
  sprintId: Schema.Types.ObjectId | null;
  milestoneId: Schema.Types.ObjectId | null;
  watchers: Schema.Types.ObjectId[];
  /** last time the task left the terminal ("done") status → derived metrics */
  statusUpdatedAt: Date;
  completedAt: Date | null;
  deletedAt: Date | null;
  deletedBy: Schema.Types.ObjectId | null;
  createdBy: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema<TaskDoc>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    number: { type: Number, required: true },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    description: { type: String, default: "" },
    status: { type: String, required: true, default: "backlog" },
    priority: { type: String, enum: ["none", "low", "medium", "high", "urgent"], default: "none" },
    assigneeId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reporterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    dueDate: { type: Date, default: null },
    startDate: { type: Date, default: null },
    estimateMin: { type: Number, default: null, min: 0, max: 525600 },
    labels: {
      type: [
        {
          _id: false,
          id: { type: String, required: true },
          name: { type: String, required: true },
          color: { type: String, required: true },
        },
      ],
      default: [],
    },
    order: { type: Number, required: true, default: 0 },
    parentId: { type: Schema.Types.ObjectId, ref: "Task", default: null },
    sprintId: { type: Schema.Types.ObjectId, ref: "Sprint", default: null },
    milestoneId: { type: Schema.Types.ObjectId, ref: "Milestone", default: null },
    watchers: { type: [Schema.Types.ObjectId], default: [] },
    statusUpdatedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, default: null },
    createdBy: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: true }
);

taskSchema.index({ projectId: 1, number: 1 }, { unique: true });
taskSchema.index({ organizationId: 1, status: 1 });
taskSchema.index({ organizationId: 1, deletedAt: 1 });
// Board/backlog hot path: tasks of one status in order.
taskSchema.index({ projectId: 1, status: 1, order: 1 });
taskSchema.index({ assigneeId: 1, status: 1 });
taskSchema.index({ dueDate: 1 });
taskSchema.index({ sprintId: 1 });
taskSchema.index({ milestoneId: 1 });
taskSchema.index({ parentId: 1, order: 1 });
taskSchema.index({ organizationId: 1, updatedAt: -1 });
// Full-text search over task titles (weights make title hits rank first).
taskSchema.index({ title: "text", description: "text" }, { name: "task_search", weights: { title: 10, description: 3 } });

export const Task: Model<TaskDoc> = models.Task ?? model<TaskDoc>("Task", taskSchema);
