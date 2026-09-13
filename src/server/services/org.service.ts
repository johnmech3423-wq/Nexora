import { connectDb } from "@/server/db/db";
import { Organization } from "@/server/db/models/organization.model";
import { Membership } from "@/server/db/models/membership.model";
import { ApiError } from "@/server/errors";
import { resolveOrgContext } from "@/server/authorization/context";
import { orgRoleHasPermission } from "@/lib/permissions";
import type { OrgPermissionKey } from "@/lib/permissions";
import type { OrgDTO, OrgMemberDTO } from "@/types";
import { DEFAULT_PLAN, type OrgRole } from "@/lib/constants";
import { logActivity } from "@/server/services/activity.service";
import { dispatchWebhookEvent } from "@/server/services/webhook.service";

import { getUserInfos } from "@/server/db/lookups";
import { serializeOrg, serializeOrgMember } from "@/server/serializers/org";

/* ------------------------------------------------------------------ */
/* Core authorization helper (re-exported for services)                */
/* ------------------------------------------------------------------ */
export async function requireOrgPermission(
  actorUserId: string,
  orgIdOrSlug: string,
  permission: OrgPermissionKey
): Promise<{ organizationId: string; role: OrgRole }> {
  const ctx = await resolveOrgContext(actorUserId, orgIdOrSlug);
  if (!orgRoleHasPermission(ctx.role, permission)) {
    throw ApiError.forbidden();
  }
  return { organizationId: ctx.organizationId, role: ctx.role };
}

export async function requireOrgRole(actorUserId: string, orgIdOrSlug: string, roles: OrgRole[]): Promise<{ organizationId: string }> {
  const ctx = await resolveOrgContext(actorUserId, orgIdOrSlug);
  if (!roles.includes(ctx.role)) throw ApiError.forbidden();
  return { organizationId: ctx.organizationId };
}

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-")
      .slice(0, 40) || "org"
  );
}

export async function generateUniqueSlug(base: string): Promise<string> {
  let candidate = base;
  let suffix = 0;
  for (;;) {
    const existing = await Organization.exists({ slug: candidate });
    if (!existing) return candidate;
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
}

/* ------------------------------------------------------------------ */
/* Organization CRUD                                                   */
/* ------------------------------------------------------------------ */

export async function createOrganization(
  actorUserId: string,
  input: { name: string; slug?: string; description?: string }
): Promise<OrgDTO> {
  await connectDb();
  const slug = await generateUniqueSlug((input.slug ?? slugify(input.name)).slice(0, 40));
  const org = await Organization.create({
    name: input.name,
    slug,
    description: input.description ?? null,
    ownerUserId: actorUserId,
    plan: { key: DEFAULT_PLAN, status: "active" },
  });
  await Membership.create({
    organizationId: org._id,
    userId: actorUserId,
    role: "owner",
    status: "active",
    joinedAt: new Date(),
  });
  void logActivity({
    organizationId: String(org._id),
    action: "org.create",
    actorId: actorUserId,
    entityType: "organization",
    entityId: String(org._id),
    metadata: { name: org.name },
  });
  return serializeOrg(org.toObject(), "owner", 1);
}

export async function listMyOrganizations(userId: string): Promise<OrgDTO[]> {
  await connectDb();
  const memberships = await Membership.find({ userId, status: "active" }).select("organizationId role").lean();
  if (memberships.length === 0) return [];

  const orgs = await Organization.find({ _id: { $in: memberships.map((m) => m.organizationId) }, deletedAt: null })
    .select("name slug description logoUrl createdAt plan.key ownerUserId")
    .lean();

  const counts = await Membership.aggregate([
    { $match: { organizationId: { $in: orgs.map((o) => o._id) }, status: "active" } },
    { $group: { _id: "$organizationId", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.count as number]));
  const roleMap = new Map(memberships.map((m) => [String(m.organizationId), m.role]));

  return orgs
    .map((org) => serializeOrg(org, roleMap.get(String(org._id)) ?? "member", countMap.get(String(org._id)) ?? 0))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getOrganizationDetail(actorUserId: string, orgIdOrSlug: string): Promise<OrgDTO> {
  await connectDb();
  const ctx = await resolveOrgContext(actorUserId, orgIdOrSlug);
  const [org, count] = await Promise.all([
    Organization.findOne({ _id: ctx.organizationId, deletedAt: null }).lean(),
    Membership.countDocuments({ organizationId: ctx.organizationId, status: "active" }),
  ]);
  if (!org) throw ApiError.notFound();
  return serializeOrg(org, ctx.role, count);
}

export async function updateOrganization(
  actorUserId: string,
  orgIdOrSlug: string,
  input: { name?: string; description?: string | null }
): Promise<OrgDTO> {
  await connectDb();
  const ctx = await requireOrgPermission(actorUserId, orgIdOrSlug, "org.update");
  const org = await Organization.findOne({ _id: ctx.organizationId, deletedAt: null });
  if (!org) throw ApiError.notFound();

  const changes: string[] = [];
  if (input.name && input.name !== org.name) {
    org.name = input.name;
    changes.push("name");
  }
  if (input.description !== undefined && input.description !== org.description) {
    org.description = input.description;
    changes.push("description");
  }
  await org.save();
  void logActivity({
    organizationId: ctx.organizationId,
    action: "org.update",
    actorId: actorUserId,
    entityType: "organization",
    entityId: ctx.organizationId,
    metadata: { changes },
  });
  const count = await Membership.countDocuments({ organizationId: ctx.organizationId, status: "active" });
  return serializeOrg(org.toObject(), ctx.role, count);
}

export async function updateOrgSettings(
  actorUserId: string,
  orgIdOrSlug: string,
  input: { restrictProjectVisibility?: boolean; allowMemberProjects?: boolean; allowMemberChannels?: boolean }
): Promise<void> {
  await connectDb();
  const ctx = await requireOrgPermission(actorUserId, orgIdOrSlug, "settings.manage");
  const org = await Organization.findOne({ _id: ctx.organizationId, deletedAt: null });
  if (!org) throw ApiError.notFound();

  if (input.restrictProjectVisibility !== undefined) org.settings.restrictProjectVisibility = input.restrictProjectVisibility;
  if (input.allowMemberProjects !== undefined) org.settings.allowMemberProjects = input.allowMemberProjects;
  if (input.allowMemberChannels !== undefined) org.settings.allowMemberChannels = input.allowMemberChannels;
  await org.save();
  void logActivity({
    organizationId: ctx.organizationId,
    action: "org.settings.update",
    actorId: actorUserId,
    entityType: "organization",
    entityId: ctx.organizationId,
    metadata: { settings: input },
  });
}

export async function deleteOrganization(actorUserId: string, orgIdOrSlug: string): Promise<void> {
  await connectDb();
  const ctx = await resolveOrgContext(actorUserId, orgIdOrSlug);
  if (ctx.role !== "owner") throw ApiError.forbidden("Only the organization owner can delete the organization.");

  await Organization.updateOne({ _id: ctx.organizationId }, { $set: { deletedAt: new Date() } });
  await Membership.updateMany({ organizationId: ctx.organizationId }, { $set: { status: "suspended" } });
  void logActivity({
    organizationId: ctx.organizationId,
    action: "org.delete",
    actorId: actorUserId,
    entityType: "organization",
    entityId: ctx.organizationId,
  });
}

export async function leaveOrganization(actorUserId: string, orgIdOrSlug: string): Promise<void> {
  await connectDb();
  const ctx = await resolveOrgContext(actorUserId, orgIdOrSlug);
  if (ctx.role === "owner") {
    const owners = await Membership.countDocuments({
      organizationId: ctx.organizationId,
      role: "owner",
      status: "active",
    });
    if (owners <= 1) {
      throw ApiError.conflict("You are the only owner. Transfer ownership before leaving.");
    }
  }
  await Membership.deleteOne({ organizationId: ctx.organizationId, userId: actorUserId });
  void logActivity({
    organizationId: ctx.organizationId,
    action: "member.leave",
    actorId: actorUserId,
  });
}

/* ------------------------------------------------------------------ */
/* Members                                                             */
/* ------------------------------------------------------------------ */

export async function listMembers(actorUserId: string, orgIdOrSlug: string): Promise<OrgMemberDTO[]> {
  await connectDb();
  const ctx = await resolveOrgContext(actorUserId, orgIdOrSlug);
  await requireOrgPermission(actorUserId, ctx.organizationId, "member.read");

  const members = await Membership.find({ organizationId: ctx.organizationId })
    .sort({ role: 1, joinedAt: 1 })
    .lean();
  const userMap = await getUserInfos(members.map((m) => String(m.userId)));
  return members.map((m) =>
    serializeOrgMember(m, userMap.get(String(m.userId)) ?? { id: String(m.userId), name: "Unknown", email: "", avatarUrl: null })
  );
}

const ROLE_RANK: Record<OrgRole, number> = { owner: 4, admin: 3, member: 2, guest: 1 };

/** Policy: higher rank manages lower rank; owners unmanaged; only owners manage admins. */
function assertCanManageRole(actorRole: OrgRole, targetRole: OrgRole): void {
  if (targetRole === "owner") throw ApiError.forbidden("Owners cannot be modified.");
  if (actorRole === "owner") return;
  if (actorRole === "admin") {
    if (targetRole === "admin") throw ApiError.forbidden("Only the owner can modify other admins.");
    return;
  }
  throw ApiError.forbidden();
}

export async function updateMemberRole(
  actorUserId: string,
  orgIdOrSlug: string,
  targetUserId: string,
  newRole: OrgRole
): Promise<void> {
  await connectDb();
  const ctx = await resolveOrgContext(actorUserId, orgIdOrSlug);
  await requireOrgPermission(actorUserId, ctx.organizationId, "member.updateRole");

  const target = await Membership.findOne({ organizationId: ctx.organizationId, userId: targetUserId });
  if (!target) throw ApiError.notFound("That member is not part of this organization.");

  if (target.role === "owner" && targetUserId !== actorUserId) {
    throw ApiError.forbidden("Organization owners cannot be modified by others.");
  }
  if (target.role === "owner" && newRole !== "owner" && targetUserId === actorUserId) {
    const owners = await Membership.countDocuments({ organizationId: ctx.organizationId, role: "owner", status: "active" });
    if (owners <= 1) {
      throw ApiError.conflict("Transfer ownership first: promote another member to Owner, then demote yourself.");
    }
  }
  assertCanManageRole(ctx.role, target.role);
  if (newRole === "owner" && ctx.role !== "owner") {
    throw ApiError.forbidden("Only the current owner can transfer ownership.");
  }

  const from = target.role;
  target.role = newRole;
  await target.save();
  void logActivity({
    organizationId: ctx.organizationId,
    action: "member.role_update",
    actorId: actorUserId,
    entityType: "membership",
    entityId: String(target._id),
    metadata: { userId: targetUserId, from, to: newRole },
  });
}

export async function updateMemberStatus(
  actorUserId: string,
  orgIdOrSlug: string,
  targetUserId: string,
  status: "active" | "suspended"
): Promise<void> {
  await connectDb();
  const ctx = await resolveOrgContext(actorUserId, orgIdOrSlug);
  await requireOrgPermission(actorUserId, ctx.organizationId, "member.remove");
  if (targetUserId === actorUserId) throw ApiError.forbidden("You cannot suspend your own account.");

  const target = await Membership.findOne({ organizationId: ctx.organizationId, userId: targetUserId });
  if (!target) throw ApiError.notFound("That member is not part of this organization.");
  if (target.role === "owner") throw ApiError.forbidden("Owners cannot be suspended.");
  assertCanManageRole(ctx.role, target.role);

  target.status = status;
  await target.save();
  void logActivity({
    organizationId: ctx.organizationId,
    action: "member.status_update",
    actorId: actorUserId,
    entityType: "membership",
    entityId: String(target._id),
    metadata: { userId: targetUserId, status },
  });
}

export async function removeMember(actorUserId: string, orgIdOrSlug: string, targetUserId: string): Promise<void> {
  await connectDb();
  const ctx = await resolveOrgContext(actorUserId, orgIdOrSlug);
  await requireOrgPermission(actorUserId, ctx.organizationId, "member.remove");
  if (targetUserId === actorUserId) {
    throw ApiError.forbidden("Use 'Leave organization' to remove yourself.");
  }

  const target = await Membership.findOne({ organizationId: ctx.organizationId, userId: targetUserId });
  if (!target) throw ApiError.notFound("That member is not part of this organization.");
  assertCanManageRole(ctx.role, target.role);

  await Membership.deleteOne({ organizationId: ctx.organizationId, userId: targetUserId });
  void logActivity({
    organizationId: ctx.organizationId,
    action: "member.remove",
    actorId: actorUserId,
    entityType: "membership",
    entityId: String(target._id),
    metadata: { userId: targetUserId, role: target.role },
  });
  void dispatchWebhookEvent(ctx.organizationId, "member.removed", {
    organizationId: ctx.organizationId,
    userId: targetUserId,
    role: target.role,
  });
}

export { ROLE_RANK };
