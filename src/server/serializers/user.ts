import type { UserDTO } from "@/types";
import { User } from "@/server/db/models/user.model";

export interface UserContext {
  user: UserDTO;
  session: { id: string; expiresAt: string };
}

export function serializeUser(user: {
  _id: unknown;
  name: string;
  email: string;
  avatarUrl: string | null;
  emailVerifiedAt: Date | null;
  passwordHash: string | null;
  twoFactor: { enabled: boolean };
  authProvider: string;
  lastLoginAt: Date | null;
  createdAt: Date;
  prefs?: { notifications?: { emailEnabled: boolean; inAppEnabled: boolean; topics?: Record<string, boolean> }; locale?: string };
}): UserDTO {
  const prefs = user.prefs ?? {};
  const notifications = prefs.notifications ?? { emailEnabled: true, inAppEnabled: true, topics: {} };
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    emailVerified: Boolean(user.emailVerifiedAt),
    hasPassword: Boolean(user.passwordHash),
    twoFactorEnabled: Boolean(user.twoFactor?.enabled),
    createdAt: user.createdAt.toISOString(),
    role: "user",
    provider: user.authProvider as UserDTO["provider"],
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    timezone: null,
    prefs: {
      notifications: {
        emailEnabled: notifications.emailEnabled,
        inAppEnabled: notifications.inAppEnabled,
        topics: notifications.topics ?? {},
      },
      locale: prefs.locale ?? "en",
    },
  };
}

export async function findUserById(id: string) {
  return User.findById(id).where("deletedAt").equals(null).lean();
}
