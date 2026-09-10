import { Schema, model, models, type Model } from "mongoose";

/** Per-project monotonic task counter (atomic, race-free task numbers). */
export interface TaskCounterDoc {
  projectId: Schema.Types.ObjectId;
  seq: number;
}

const counterSchema = new Schema<TaskCounterDoc>({
  projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
  seq: { type: Number, required: true, default: 0 },
});

counterSchema.index({ projectId: 1 }, { unique: true });

export const TaskCounter: Model<TaskCounterDoc> =
  models.TaskCounter ?? model<TaskCounterDoc>("TaskCounter", counterSchema);

/** Atomically reserves the next task number for a project. */
export async function nextTaskNumber(projectId: string): Promise<number> {
  const doc = await TaskCounter.findOneAndUpdate(
    { projectId },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return doc.seq;
}
