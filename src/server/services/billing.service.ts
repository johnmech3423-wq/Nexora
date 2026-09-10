/* ------------------------------------------------------------------ */
/* Plan helpers — single server-side gate for plan limits/features.    */
/* Billing provider integration is architected (STRIPE_* env) but a    */
/* real checkout is optional: local upgrades mutate the org plan,      */
/* which is exactly what provider webhooks would do in production.     */
/* ------------------------------------------------------------------ */
import { ApiError } from "@/server/errors";
import { connectDb } from "@/server/db/db";
import { Organization } from "@/server/db/models/organization.model";
import { PLAN_LIMITS, DEFAULT_PLAN, type PlanKey } from "@/lib/constants";

export async function getOrgPlan(organizationId: string): Promise<{ key: PlanKey; status: string; trialEndsAt: Date | null; renewalAt: Date | null }> {
  await connectDb();
  const org = await Organization.findById(organizationId).select("plan").lean();
  if (!org) throw ApiError.notFound("Organization not found.");
  return { key: org.plan.key, status: org.plan.status, trialEndsAt: org.plan.trialEndsAt, renewalAt: org.plan.renewalAt };
}

/** Throw plan_required when the org plan lacks a boolean feature. */
export async function assertPlanFeature(
  organizationId: string,
  feature: "advancedAnalytics" | "timeTracking" | "sprints" | "webhooks" | "aiRequestsPerMemberPerDay"
): Promise<PlanKey> {
  const { key } = await getOrgPlan(organizationId);
  const limits = PLAN_LIMITS[key];
  let ok = true;
  if (feature === "advancedAnalytics") ok = limits.advancedAnalytics;
  if (feature === "timeTracking") ok = limits.timeTracking;
  if (feature === "sprints") ok = limits.sprints;
  if (feature === "webhooks") ok = limits.webhooks > 0;
  if (feature === "aiRequestsPerMemberPerDay") ok = limits.aiRequestsPerMemberPerDay > 0;
  if (!ok) {
    throw new ApiError({
      status: 402,
      code: "plan_required",
      message: `This feature requires the Pro or Business plan.`,
      expose: true,
    });
  }
  return key;
}

/** Active member seat check used before invites/joins. */
export async function assertSeatAvailable(organizationId: string, extra = 1): Promise<void> {
  await connectDb();
  const org = await Organization.findById(organizationId).select("plan").lean();
  if (!org) throw ApiError.notFound("Organization not found.");
  const maxMembers = PLAN_LIMITS[org.plan.key].members;
  if (maxMembers === null) return;
  const { Membership } = await import("@/server/db/models/membership.model");
  const current = await Membership.countDocuments({ organizationId, status: { $in: ["active", "pending"] } });
  if (current + extra > maxMembers) {
    throw new ApiError({
      status: 402,
      code: "plan_required",
      message: `Your plan includes ${maxMembers} members. Upgrade to add more.`,
      expose: true,
    });
  }
}

/** Simulated provider checkout/upgrade (local driver). */
export async function setPlan(organizationId: string, key: PlanKey): Promise<{ key: PlanKey; status: string }> {
  await connectDb();
  const org = await Organization.findByIdAndUpdate(
    organizationId,
    { $set: { "plan.key": key, "plan.status": "active", "plan.updatedAt": new Date() } },
    { new: true }
  );
  if (!org) throw ApiError.notFound("Organization not found.");
  return { key: org.plan.key, status: org.plan.status };
}

export async function cancelPlan(organizationId: string): Promise<{ key: PlanKey; status: string }> {
  await connectDb();
  const org = await Organization.findByIdAndUpdate(
    organizationId,
    { $set: { "plan.key": DEFAULT_PLAN, "plan.status": "canceled", "plan.updatedAt": new Date() } },
    { new: true }
  );
  if (!org) throw ApiError.notFound("Organization not found.");
  return { key: org.plan.key, status: org.plan.status };
}
