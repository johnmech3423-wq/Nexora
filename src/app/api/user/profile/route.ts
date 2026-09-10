import type { NextRequest } from "next/server";
import { handleApi, ok, parseBody } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { User } from "@/server/db/models/user.model";
import { serializeUser } from "@/server/serializers/user";
import { updateProfileSchema } from "@/validations/auth.schema";

export const runtime = "nodejs";

/** PATCH /api/user/profile — update display name. */
export const PATCH = handleApi(async (req: NextRequest) => {
  const session = await requireUser();
  const body = await parseBody(req, updateProfileSchema);
  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = body.name;
  if (body.avatarUrl !== undefined) patch.avatarUrl = body.avatarUrl;
  const user = await User.findByIdAndUpdate(session.user._id, { $set: patch }, { new: true });
  if (!user) throw new Error("User disappeared mid-request");
  return ok({ user: serializeUser(user) });
});
