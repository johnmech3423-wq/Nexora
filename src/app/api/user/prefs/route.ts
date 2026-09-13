import type { NextRequest } from "next/server";
import { handleApi, ok, parseBody } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { User } from "@/server/db/models/user.model";
import { serializeUser } from "@/server/serializers/user";
import { updateNotificationPrefsSchema } from "@/validations/auth.schema";
import { NOTIFICATION_PREF_KEYS } from "@/lib/constants";
import { logActivity } from "@/server/services/activity.service";

export const runtime = "nodejs";

/** PUT /api/user/prefs — notification preferences (whitelisted keys only). */
export const PUT = handleApi(async (req: NextRequest) => {
  const session = await requireUser();
  const body = await parseBody(req, updateNotificationPrefsSchema);

  const sanitized: Record<string, boolean> = {};
  for (const key of NOTIFICATION_PREF_KEYS) {
    sanitized[key] = body.topics?.[key] !== false;
  }

  const user = await User.findByIdAndUpdate(
    session.user._id,
    {
      $set: {
        prefs: {
          notifications: { emailEnabled: body.emailEnabled, inAppEnabled: body.inAppEnabled, topics: sanitized },
        },
      },
    },
    { new: true }
  );
  if (!user) throw new Error("User disappeared mid-request");
  void logActivity({ organizationId: null, action: "notification.prefs_update", actorId: String(session.user._id) });
  return ok({ user: await serializeUser(user) });
});
