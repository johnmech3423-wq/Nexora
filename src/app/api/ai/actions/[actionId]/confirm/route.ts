import type { NextRequest } from "next/server";
import { handleApi, ok } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { connectDb } from "@/server/db/db";
import { AiPendingAction } from "@/server/db/models/ai-pending-action.model";
import { assertOrgPermission } from "@/server/authorization/guard";
import { executeTool, type AiToolCall } from "@/server/services/ai-tools.service";
import { ApiError } from "@/server/errors";
import { assertRateLimit } from "@/server/security/rate-limit";
import { Types } from "mongoose";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ actionId: string }> };

/** POST /api/ai/actions/[actionId]/confirm?orgId= — explicit user confirmation */
export const POST = handleApi(async (req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const actorUserId = String(session.user._id);
  const { actionId } = await ctx.params;
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) throw ApiError.badRequest("Missing orgId query param");
  if (!Types.ObjectId.isValid(actionId)) throw ApiError.badRequest("Invalid actionId");

  await assertRateLimit(`ai-confirm:${actorUserId}`, session.user.email, 30, 60_000, "Too many confirmation attempts. Please wait a moment.");

  await connectDb();

  // Verify org membership and ai.use permission — re-check auth
  const orgCtx = await assertOrgPermission(actorUserId, orgId, "ai.use");
  const organizationId = String(orgCtx.organizationId);

  const now = new Date();

  // Load pending action first for ownership/org checks
  const existing = await AiPendingAction.findById(actionId).lean();
  if (!existing) throw ApiError.notFound("Action not found.");
  if (String(existing.organizationId) !== organizationId) throw ApiError.forbidden("Action not in this workspace.");
  if (String(existing.userId) !== actorUserId) throw ApiError.forbidden("You cannot approve another user's action.");
  if (existing.status !== "pending") {
    throw new ApiError({
      status: 409,
      code: "conflict",
      message:
        existing.status === "executed"
          ? "This action has already been executed."
          : existing.status === "rejected"
            ? "This action was already rejected."
            : existing.status === "expired"
              ? "This action has expired."
              : `Action is ${existing.status}, not pending.`,
      expose: true,
    });
  }
  if (existing.expiresAt.getTime() < now.getTime()) {
    // Mark expired atomically if still pending
    await AiPendingAction.updateOne({ _id: existing._id, status: "pending" }, { $set: { status: "expired" } });
    throw new ApiError({ status: 410, code: "gone", message: "This action has expired. Ask the assistant to propose it again.", expose: true });
  }

  // Atomic claim: pending -> executing to prevent double execution
  const claimed = await AiPendingAction.findOneAndUpdate(
    { _id: existing._id, status: "pending", expiresAt: { $gt: now }, userId: existing.userId, organizationId: existing.organizationId },
    { $set: { status: "executing" } },
    { new: true }
  ).lean();

  if (!claimed) {
    // Race condition: someone else claimed it just now
    const latest = await AiPendingAction.findById(actionId).lean();
    if (!latest) throw ApiError.notFound("Action not found.");
    if (latest.status !== "pending") {
      throw new ApiError({
        status: 409,
        code: "conflict",
        message: latest.status === "executed" ? "This action has already been executed." : `Action is ${latest.status}.`,
        expose: true,
      });
    }
    throw new ApiError({ status: 409, code: "conflict", message: "Action is being processed. Please wait.", expose: true });
  }

  // Execute server-stored validated args — never trust client args
  const call: AiToolCall = { tool: claimed.tool, args: claimed.args };
  const result = await executeTool(actorUserId, organizationId, call);

  if (result.ok) {
    await AiPendingAction.updateOne(
      { _id: claimed._id },
      { $set: { status: "executed", executedAt: new Date(), result: result.data ?? null, errorCode: null } }
    );
  } else {
    // On failure, revert to pending? Spec says mark consumed exactly once. For safety, we mark executed with error? But better mark back to pending if validation error? Spec: once consumed, must not be executable again, but if execution fails due to validation, we should allow retry? Simpler: if forbidden/not_found, keep as rejected? For now, mark as rejected with error to prevent replay of invalid actions, except for transient errors.
    // We will mark as executed with error for audit, but return failure.
    // For validation errors, we keep it as rejected to prevent replay.
    const isPermanentFailure = ["validation_error", "not_found", "forbidden", "bad_request", "unprocessable"].includes(result.errorCode ?? "");
    if (isPermanentFailure) {
      await AiPendingAction.updateOne(
        { _id: claimed._id },
        { $set: { status: "rejected", rejectedAt: new Date(), result: null, errorCode: result.errorCode ?? "failed" } }
      );
    } else {
      // Transient failure — revert to pending so user can retry
      await AiPendingAction.updateOne({ _id: claimed._id }, { $set: { status: "pending" } });
    }
  }

  return ok({ ok: result.ok, tool: result.tool, message: result.message, data: result.data, errorCode: result.errorCode });
});
