import { Schema, model, models, type Model } from "mongoose";

export interface OAuthIdentity {
  provider: "google" | "github";
  providerId: string;
}

export interface NotificationPrefs {
  emailEnabled: boolean;
  inAppEnabled: boolean;
  /** topic key -> opted in (keys from NOTIFICATION_PREF_KEYS) */
  topics: Record<string, boolean>;
}

export interface UserPrefsDoc {
  notifications: NotificationPrefs;
  locale: string;
}

export interface UserDoc {
  email: string;
  passwordHash: string | null; // null when OAuth-only (must set password before password login)
  name: string;
  avatarUrl: string | null;
  avatarFileId: Schema.Types.ObjectId | null;
  prefs: UserPrefsDoc;
  authProvider: "email" | "google" | "github";
  oauthIdentities: OAuthIdentity[];
  emailVerifiedAt: Date | null;
  verificationTokenHash: string | null;
  verificationTokenExpiresAt: Date | null;
  resetTokenHash: string | null;
  resetTokenExpiresAt: Date | null;
  passwordChangedAt: Date | null;
  twoFactor: {
    enabled: boolean;
    /** AES-256-GCM encrypted TOTP secret (key derived from AUTH_SECRET) */
    secretEncrypted: string | null;
  };
  lastLoginAt: Date | null;
  suspendedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDoc>(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, default: null },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    avatarUrl: { type: String, default: null },
    avatarFileId: { type: Schema.Types.ObjectId, ref: "File", default: null },
    prefs: {
      notifications: {
        emailEnabled: { type: Boolean, default: true },
        inAppEnabled: { type: Boolean, default: true },
        topics: { type: Schema.Types.Mixed, default: {} },
      },
      locale: { type: String, default: "en" },
    },
    authProvider: { type: String, enum: ["email", "google", "github"], default: "email" },
    oauthIdentities: {
      type: [
        {
          _id: false,
          provider: { type: String, enum: ["google", "github"] },
          providerId: { type: String },
        },
      ],
      default: [],
    },
    emailVerifiedAt: { type: Date, default: null },
    verificationTokenHash: { type: String, default: null },
    verificationTokenExpiresAt: { type: Date, default: null },
    resetTokenHash: { type: String, default: null },
    resetTokenExpiresAt: { type: Date, default: null },
    passwordChangedAt: { type: Date, default: null },
    twoFactor: {
      enabled: { type: Boolean, default: false },
      secretEncrypted: { type: String, default: null },
    },
    lastLoginAt: { type: Date, default: null },
    suspendedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ "oauthIdentities.provider": 1, "oauthIdentities.providerId": 1 }, { sparse: true, unique: true });
userSchema.index({ deletedAt: 1 });

export const User: Model<UserDoc> = models.User ?? model<UserDoc>("User", userSchema);
