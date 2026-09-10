import type { NextRequest } from "next/server";
import { handleApi, ok, parseBody } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { cancelPlan, setPlan } from "@/server/services/billing.service";
import { resolveOrgContext } from "@/server/authorization/context";
import { ApiError } from "@/server/errors";
import { z } from "zod";
import { logActivity } from "@/server/services/activity.service";

export const runtime = "nodejs";

const planSchema = z.object({ plan: z.enum(["free", "pro", "business"]) });
type PlanBody = z.infer<typeof planSchema>;

type Ctx = { params: Promise<{ orgId: string }> };

/**
 * Owner-only plan switch.
 * Local driver: mutates the org plan directly (equivalent to what the
 * Stripe webhook would apply after checkout). In production the client
 * would instead hit the checkout endpoint — see README "Billing".
 */
export const PATCH = handleApi(async (req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { orgId } = await ctx.params;
  const body = await parseBody(req, planSchema);
  await assertOwner(String(session.user._id), orgId);
  const result = await setPlan(orgId, body.plan);
  void logActivity({
    organizationId: orgId,
    actorId: String(session.user._id),
    action: "org.plan_update",
    entityType: "organization",
    entityId: orgId,
    metadata: { to: body.plan },
  });
  return ok(result);
});

/** Owner-only downgrade/cancel (downgrades to Free). */
export const DELETE = handleApi(async (_req: NextRequest, ctx: Ctx) => {
  const session = await requireUser();
  const { orgId } = await ctx.params;
  await assertOwner(String(session.user._id), orgId);
  const result = await cancelPlan(orgId);
  void logActivity({
    organizationId: orgId,
    actorId: String(session.user._id),
    action: "org.plan_update",
    entityType: "organization",
    entityId: orgId,
    metadata: { to: "free" },
  });
  return ok(result);
});

async function assertOwner(actorUserId: string, orgId: string): Promise<void> {
  const ctx = await resolveOrgContext(actorUserId, orgId);
  if (ctx.role !== "owner") {
    throw ApiError.forbidden("Only the organization owner can change the plan.");
  }
}
