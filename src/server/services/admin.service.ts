/* ------------------------------------------------------------------ */
/* Platform admin — restricted to users whose email is in ADMIN_EMAILS */
/* (server-side allowlist; never client-side). Scope: user account     */
/* oversight (suspend/restore), org listing & audit, platform stats.   */
/* ------------------------------------------------------------------ */
import { ApiError } from "@/server/errors";
import { connectDb } from "@/server/db/db";
import { User } from "@/server/db/models/user.model";
import { Organization } from "@/server/db/models/organization.model";
import { Membership } from "@/server/db/models/membership.model";
import { ActivityLog } from "@/server/db/models/activity-log.model";
import { env } from "@/lib/env";

export interface PlatformAdminContext {
  email: string;
}

export async function requirePlatformAdmin(email: string): Promise<PlatformAdminContext> {
  const allowed = (env.platformAdminEmails ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!allowed.length || !allowed.includes(email.toLowerCase())) {
    throw ApiError.forbidden("Platform admin access is restricted.");
  }
  return { email };
}

export async function platformOverview(): Promise<{
  users: { total: number; verified: number; activeSessionsToday: number };
  organizations: { total: number; totalMembers: number };
  signupsLast7d: number;
  activityLast24h: number;
}> {
  await connectDb();
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000);
  const { Session } = await import("@/server/db/models/session.model");
  const [users, verified, sessions, orgs, members, signups, activity] = await Promise.all([
    User.countDocuments({ deletedAt: null }),
    User.countDocuments({ deletedAt: null, emailVerifiedAt: { $ne: null } }),
    Session.countDocuments({ lastActiveAt: { $gte: dayAgo }, revokedAt: null }),
    Organization.countDocuments({ deletedAt: null }),
    Membership.countDocuments({}),
    User.countDocuments({ createdAt: { $gte: weekAgo } }),
    ActivityLog.countDocuments({ createdAt: { $gte: dayAgo } }),
  ]);
  return {
    users: { total: users, verified, activeSessionsToday: sessions },
    organizations: { total: orgs, totalMembers: members },
    signupsLast7d: signups,
    activityLast24h: activity,
  };
}

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  verified: boolean;
  suspended: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  organizationCount: number;
}

export async function listUsers(opts: { q?: string; page?: number; pageSize?: number } = {}): Promise<{ items: AdminUserRow[]; total: number }> {
  await connectDb();
  const page = opts.page ?? 1;
  const pageSize = Math.min(opts.pageSize ?? 25, 100);
  const filter: Record<string, unknown> = { deletedAt: null };
  if (opts.q) {
    const rx = new RegExp(opts.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ email: rx }, { name: rx }];
  }
  const [rows, total, memberships] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    User.countDocuments(filter),
    Membership.aggregate<{ _id: string; count: number }>([{ $group: { _id: "$userId", count: { $sum: 1 } } }]),
  ]);
  const memCount = new Map(memberships.map((m) => [String(m._id), m.count]));
  return {
    total,
    items: rows.map((u) => ({
      id: String(u._id),
      email: u.email,
      name: u.name,
      verified: Boolean(u.emailVerifiedAt),
      suspended: Boolean(u.suspendedAt),
      createdAt: new Date(u.createdAt).toISOString(),
      lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt).toISOString() : null,
      organizationCount: memCount.get(String(u._id)) ?? 0,
    })),
  };
}

export interface AdminOrgRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  members: number;
  createdAt: string;
}

export async function listOrganizations(opts: { q?: string; page?: number; pageSize?: number } = {}): Promise<{ items: AdminOrgRow[]; total: number }> {
  await connectDb();
  const page = opts.page ?? 1;
  const pageSize = Math.min(opts.pageSize ?? 25, 100);
  const filter: Record<string, unknown> = { deletedAt: null };
  if (opts.q) {
    const rx = new RegExp(opts.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: rx }, { slug: rx }];
  }
  const [rows, total, memberCounts] = await Promise.all([
    Organization.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    Organization.countDocuments(filter),
    Membership.aggregate<{ _id: string; count: number }>([{ $group: { _id: "$organizationId", count: { $sum: 1 } } }]),
  ]);
  const count = new Map(memberCounts.map((m) => [String(m._id), m.count]));
  return {
    total,
    items: rows.map((o) => ({
      id: String(o._id),
      name: o.name,
      slug: o.slug,
      plan: o.plan.key,
      members: count.get(String(o._id)) ?? 0,
      createdAt: new Date(o.createdAt).toISOString(),
    })),
  };
}

export async function suspendUser(actorEmail: string, targetUserId: string, suspended: boolean): Promise<{ suspended: boolean }> {
  await requirePlatformAdmin(actorEmail);
  await connectDb();
  const target = await User.findById(targetUserId).select("email").lean();
  if (!target) throw ApiError.notFound("User not found.");
  if (target.email.toLowerCase() === actorEmail.toLowerCase()) throw ApiError.badRequest("You cannot suspend your own admin account.");
  await User.updateOne({ _id: targetUserId }, { $set: { suspendedAt: suspended ? new Date() : null } });
  if (suspended) {
    await Membership.updateMany({ userId: targetUserId }, { $set: { status: "suspended" } });
    const { Session } = await import("@/server/db/models/session.model");
    await Session.updateMany({ userId: targetUserId, revokedAt: null }, { $set: { revokedAt: new Date() } });
  } else {
    await Membership.updateMany({ userId: targetUserId }, { $set: { status: "active" } });
  }
  return { suspended };
}

export async function setOrgPlan(actorEmail: string, orgId: string, plan: string): Promise<{ plan: string }> {
  await requirePlatformAdmin(actorEmail);
  if (!["free", "pro", "business"].includes(plan)) throw ApiError.badRequest("Invalid plan.");
  await connectDb();
  const res = await Organization.updateOne(
    { _id: orgId, deletedAt: null },
    { $set: { "plan.key": plan, "plan.status": "active", "plan.updatedAt": new Date() } }
  );
  if (!res.matchedCount) throw ApiError.notFound("Organization not found.");
  return { plan };
}
