import { Schema, model, models, type Model } from "mongoose";

export interface PlatformConfigDoc {
  admins: { emails: string[] };
  storage: { driver: "local" | "cloudinary" };
  smtp: {
    host: string | null;
    port: number;
    secure: boolean;
    user: string | null;
    passEncrypted: string | null;
    mailFrom: string | null;
  };
  cloudinary: {
    cloudName: string | null;
    apiKey: string | null;
    apiSecretEncrypted: string | null;
  };
  ai: {
    provider: "none" | "openai-compatible" | "anthropic";
    apiKeyEncrypted: string | null;
    baseUrl: string | null;
    model: string | null;
  };
  realtime: {
    driver: "none" | "pusher";
    appId: string | null;
    key: string | null;
    secretEncrypted: string | null;
    cluster: string | null;
  };
  platform: {
    name: string;
    supportEmail: string;
    maintenanceMode: boolean;
    allowRegistration: boolean;
  };
  updatedByEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const platformConfigSchema = new Schema<PlatformConfigDoc>(
  {
    admins: { emails: { type: [String], default: [] } },
    storage: { driver: { type: String, enum: ["local", "cloudinary"], default: "local" } },
    smtp: {
      host: { type: String, default: null },
      port: { type: Number, default: 587, min: 1, max: 65535 },
      secure: { type: Boolean, default: false },
      user: { type: String, default: null },
      passEncrypted: { type: String, default: null },
      mailFrom: { type: String, default: null },
    },
    cloudinary: {
      cloudName: { type: String, default: null },
      apiKey: { type: String, default: null },
      apiSecretEncrypted: { type: String, default: null },
    },
    ai: {
      provider: { type: String, enum: ["none", "openai-compatible", "anthropic"], default: "none" },
      apiKeyEncrypted: { type: String, default: null },
      baseUrl: { type: String, default: null },
      model: { type: String, default: null },
    },
    realtime: {
      driver: { type: String, enum: ["none", "pusher"], default: "none" },
      appId: { type: String, default: null },
      key: { type: String, default: null },
      secretEncrypted: { type: String, default: null },
      cluster: { type: String, default: null },
    },
    platform: {
      name: { type: String, default: "Nexora", trim: true, maxlength: 80 },
      supportEmail: { type: String, default: "hello@nexora.app", trim: true, maxlength: 254 },
      maintenanceMode: { type: Boolean, default: false },
      allowRegistration: { type: Boolean, default: true },
    },
    updatedByEmail: { type: String, default: null },
  },
  { timestamps: true }
);

export const PlatformConfig: Model<PlatformConfigDoc> =
  models.PlatformConfig ?? model<PlatformConfigDoc>("PlatformConfig", platformConfigSchema);
