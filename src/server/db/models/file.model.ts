import { Schema, model, models, type Model } from "mongoose";
import type { FileKind } from "@/lib/constants";

export interface FileDoc {
  organizationId: Schema.Types.ObjectId | null;
  projectId: Schema.Types.ObjectId | null;
  kind: FileKind;
  ownerType: string | null; // task | comment | project | conversation | user
  ownerId: Schema.Types.ObjectId | null;
  uploaderId: Schema.Types.ObjectId;
  name: string;
  mime: string;
  size: number;
  storageProvider: "local" | "cloudinary";
  storageKey: string; // local relative path or cloudinary public_id
  url: string;
  sha256: string | null;
  isImage: boolean;
  width: number | null;
  height: number | null;
  createdAt: Date;
}

const fileSchema = new Schema<FileDoc>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", default: null, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", default: null, index: true },
    kind: { type: String, enum: ["avatar", "task_attachment", "comment_attachment", "project_file", "message_attachment"], required: true },
    ownerType: { type: String, default: null },
    ownerId: { type: Schema.Types.ObjectId, default: null },
    uploaderId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true },
    mime: { type: String, required: true },
    size: { type: Number, required: true },
    storageProvider: { type: String, enum: ["local", "cloudinary"], required: true },
    storageKey: { type: String, required: true },
    url: { type: String, default: null },
    sha256: { type: String, default: null },
    isImage: { type: Boolean, default: false },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
  },
  { timestamps: true }
);

fileSchema.index({ ownerType: 1, ownerId: 1 });

export const File: Model<FileDoc> = models.File ?? model<FileDoc>("File", fileSchema);
