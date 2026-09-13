import type { NextRequest } from "next/server";
import { handleApi, ok } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { connectDb } from "@/server/db/db";
import { AiPendingAction } from "@/server/db/models/ai-pending-action.model";
import { assertOrgPermission } from "@/server/authorization/guard";
import { ApiError } from "@/server/errors";
import { assertRateLimit } from "@/server/security/rate-limit";
import { Types } from "mongoose";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ actionId: string }> };

/** POST /api/ai/actions/[actionId]/reject?orgId= — explicit user rejection */
export const POST = handleApi(async (req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const actorUserId = String(session.user._id);
  const { actionId } = await ctx.params;
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) throw ApiError.badRequest("Missing orgId query param");
  if (!Types.ObjectId.isValid(actionId)) throw ApiError.badRequest("Invalid actionId");

  await assertRateLimit(`ai-reject:${actorUserId}`, session.user.email, 60, 60_000, "Too many rejection attempts. Please wait a moment.");

  await connectDb();
  const orgCtx = await assertOrgPermission(actorUserId, orgId, "ai.use");
  const organizationId = String(orgCtx.organizationId);

  const existing = await AiPendingAction.findById(actionId).lean();
  if (!existing) throw ApiError.notFound("Action not found.");
  if (String(existing.organizationId) !== organizationId) throw ApiError.forbidden("Action not in this workspace.");
  if (String(existing.userId) !== actorUserId) throw ApiError.forbidden("You cannot reject another user's action.");

  if (existing.status !== "pending") {
    throw new ApiError({
      status: 409,
      code: "conflict",
      message: existing.status === "executed" ? "Action already executed." : existing.status === "rejected" ? "Action already rejected." : `Action is ${existing.status}.`,
      expose: true,
    });
  }

  const now = new Date();
  if (existing.expiresAt.getTime() < now.getTime()) {
    await AiPendingAction.updateOne({ _id: existing._id, status: "pending" }, { $set: { status: "expired" } });
    throw new ApiError({ status: 410, code: "gone", message: "This action has expired.", expose: true });
  }

  const updated = await AiPendingAction.findOneAndUpdate(
    { _id: existing._id, status: "pending" },
    { $set: { status: "rejected", rejectedAt: new Date() } },
    { new: true }
  ).lean();

  if (!updated) {
    throw new ApiError({ status: 409, code: "conflict", message: "Action already processed.", expose: true });
  }

  return ok({ ok: true, status: "rejected", id: String(updated._id) });
});
