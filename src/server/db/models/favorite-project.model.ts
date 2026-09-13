import { Schema, model, models, type Model } from "mongoose";

export interface FavoriteProjectDoc {
  userId: Schema.Types.ObjectId;
  projectId: Schema.Types.ObjectId;
  organizationId: Schema.Types.ObjectId;
  createdAt: Date;
}

const favSchema = new Schema<FavoriteProjectDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
  },
  { timestamps: true }
);

favSchema.index({ userId: 1, projectId: 1 }, { unique: true });
favSchema.index({ userId: 1, createdAt: -1 });

export const FavoriteProject: Model<FavoriteProjectDoc> =
  models.FavoriteProject ?? model<FavoriteProjectDoc>("FavoriteProject", favSchema);
