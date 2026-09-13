import { Schema, model, models, type Model } from "mongoose";

export interface CommentReaction {
  emoji: string;
  userIds: Schema.Types.ObjectId[];
}

export interface TaskCommentDoc {
  taskId: Schema.Types.ObjectId;
  projectId: Schema.Types.ObjectId;
  organizationId: Schema.Types.ObjectId;
  parentId: Schema.Types.ObjectId | null;
  authorId: Schema.Types.ObjectId;
  body: string;
  mentions: Schema.Types.ObjectId[];
  reactions: CommentReaction[];
  editedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const commentSchema = new Schema<TaskCommentDoc>(
  {
    taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    parentId: { type: Schema.Types.ObjectId, ref: "TaskComment", default: null },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true, maxlength: 20_000 },
    mentions: { type: [Schema.Types.ObjectId], default: [] },
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

commentSchema.index({ taskId: 1, createdAt: 1 });
commentSchema.index({ parentId: 1, createdAt: 1 });
commentSchema.index({ organizationId: 1, createdAt: -1 });
commentSchema.index({ authorId: 1, createdAt: -1 });
// Full-text search over comment bodies.
commentSchema.index({ body: "text" }, { name: "comment_search" });

export const TaskComment: Model<TaskCommentDoc> =
  models.TaskComment ?? model<TaskCommentDoc>("TaskComment", commentSchema);
