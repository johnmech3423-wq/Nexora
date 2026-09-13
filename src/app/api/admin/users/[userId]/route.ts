import type { NextRequest } from "next/server";
import { handleApi, ok, parseBody } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { requirePlatformAdmin, suspendUser } from "@/server/services/admin.service";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({ suspended: z.boolean() });

type Ctx = { params: Promise<{ userId: string }> };

/** PATCH /api/admin/users/:id — suspend or restore an account. */
export const PATCH = handleApi(async (req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  await requirePlatformAdmin(session.user.email);
  const { userId } = await ctx.params;
  const body = await parseBody(req, schema);
  const result = await suspendUser(session.user.email, userId, body.suspended);
  return ok(result);
});
