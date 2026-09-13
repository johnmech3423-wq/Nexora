import { connectDb } from "@/server/db/db";
import { Invitation, type InvitationDoc } from "@/server/db/models/invitation.model";
import { Membership } from "@/server/db/models/membership.model";
import { Organization } from "@/server/db/models/organization.model";
import { User } from "@/server/db/models/user.model";
import { ApiError } from "@/server/errors";
import { requireOrgPermission } from "@/server/services/org.service";
import { logActivity } from "@/server/services/activity.service";
import { dispatchWebhookEvent } from "@/server/services/webhook.service";

import { sendMail, appLink } from "@/server/email/mailer";
import { invitationTemplate } from "@/server/email/templates";
import { hashToken, createRandomToken } from "@/server/security/tokens";
import { rateLimit } from "@/server/security/rate-limit";
import { getUserInfos } from "@/server/db/lookups";
import { serializeInvitation } from "@/server/serializers/org";
import {
  INVITATION_TTL_MS,
  PLAN_LIMITS,
  ORG_ROLE_LABELS,
  type OrgRole,
} from "@/lib/constants";
import type { InvitationDTO } from "@/types";

export interface PublicInvitationInfo {
  organizationName: string;
  inviterName: string;
  email: string;
  role: OrgRole;
  expiresAt: string;
  status: "pending";
  memberAlready: boolean;
  hasAccount: boolean;
}

/* ------------------------------------------------------------------ */
/* Invite                                                              */
/* ------------------------------------------------------------------ */

export async function inviteMembers(
  actorUserId: string,
  orgIdOrSlug: string,
  input: { emails: string[]; role: OrgRole; message?: string }
): Promise<{ invitations: InvitationDTO[]; skippedExisting: string[] }> {
  await connectDb();
  const ctx = await requireOrgPermission(actorUserId, orgIdOrSlug, "member.invite");
  const org = await Organization.findOne({ _id: ctx.organizationId, deletedAt: null }).lean();
  if (!org) throw ApiError.notFound();

  // --- Plan gate: member limits -------------------------------------
  const activeMembers = await Membership.countDocuments({ organizationId: ctx.organizationId, status: "active" });
  const pendingCount = await Invitation.countDocuments({ organizationId: ctx.organizationId, status: "pending" });
  const limit = PLAN_LIMITS[org.plan.key].members;
  if (limit !== null && activeMembers + pendingCount + input.emails.length > limit) {
    throw ApiError.planRequired(
      `Your ${org.plan.key} plan supports up to ${limit} members (${activeMembers + pendingCount} members or pending invites now).`
    );
  }

  const uniqueEmails = [...new Set(input.emails.map((e) => e.toLowerCase().trim()))];
  const pendingDocs = await Invitation.find({ organizationId: ctx.organizationId, email: { $in: uniqueEmails }, status: "pending" })
    .select("email")
    .lean();
  const pendingEmails = new Set(pendingDocs.map((i) => i.email));

  const usersByEmail = new Map(
    (await User.find({ email: { $in: uniqueEmails }, deletedAt: null }).select("_id email").lean()).map((u) => [u.email, u])
  );
  const memberUserIds = await Membership.find({ organizationId: ctx.organizationId }).select("userId").lean();
  const memberSet = new Set(memberUserIds.map((m) => String(m.userId)));

  const inviter = (await getUserInfos([actorUserId])).get(actorUserId)?.name ?? "Someone";
  const created: InvitationDTO[] = [];
  const skippedExisting: string[] = [];

  for (const email of uniqueEmails) {
    const existingUser = usersByEmail.get(email);
    if (existingUser && memberSet.has(String(existingUser._id))) {
      skippedExisting.push(email); // already a member
      continue;
    }
    if (pendingEmails.has(email)) {
      skippedExisting.push(email); // pending invite exists
      continue;
    }

    const rawToken = createRandomToken(32);
    const doc = await Invitation.create({
      organizationId: ctx.organizationId,
      email,
      role: input.role,
      invitedBy: actorUserId,
      tokenHash: hashToken(rawToken),
      status: "pending",
      expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
      invitedAt: new Date(),
      resendCount: 0,
      lastSentAt: new Date(),
    });

    // Token travels by email only — never appears in the API response.
    const link = appLink(`/invitations/${rawToken}`);
    const mail = invitationTemplate({
      inviterName: inviter,
      orgName: org.name,
      roleLabel: ORG_ROLE_LABELS[input.role],
      link,
    });
    await sendMail({ to: email, subject: mail.subject, html: mail.html, text: mail.text });

    void logActivity({
      organizationId: ctx.organizationId,
      action: "member.invite",
      actorId: actorUserId,
      entityType: "invitation",
      entityId: String(doc._id),
      metadata: { email, role: input.role },
    });
    created.push(serializeInvitation(doc.toObject(), inviter));
  }
  return { invitations: created, skippedExisting };
}

/* ------------------------------------------------------------------ */
/* Manage (list / revoke / resend)                                     */
/* ------------------------------------------------------------------ */

export async function listInvitations(actorUserId: string, orgIdOrSlug: string): Promise<InvitationDTO[]> {
  await connectDb();
  const ctx = await requireOrgPermission(actorUserId, orgIdOrSlug, "invitation.manage");
  const invites = await Invitation.find({ organizationId: ctx.organizationId }).sort({ createdAt: -1 }).limit(100).lean();
  const inviterMap = await getUserInfos(invites.map((i) => String(i.invitedBy)));
  return invites.map((i) => serializeInvitation(i, inviterMap.get(String(i.invitedBy))?.name ?? "Unknown"));
}

async function getPendingInvitationForOrg(
  organizationId: string,
  invitationId: string
): Promise<InstanceType<typeof Invitation>> {
  const doc = await Invitation.findOne({ _id: invitationId, organizationId });
  if (!doc) throw ApiError.notFound("That invitation no longer exists.");
  return doc;
}

export async function revokeInvitation(actorUserId: string, orgIdOrSlug: string, invitationId: string): Promise<void> {
  await connectDb();
  const ctx = await requireOrgPermission(actorUserId, orgIdOrSlug, "invitation.manage");
  const doc = await getPendingInvitationForOrg(ctx.organizationId, invitationId);
  if (doc.status === "accepted") throw ApiError.conflict("That invitation was already accepted.");
  if (doc.status === "revoked" || doc.status === "declined") throw ApiError.conflict("That invitation was already resolved.");
  doc.status = "revoked";
  doc.revokedAt = new Date();
  await doc.save();
  void logActivity({
    organizationId: ctx.organizationId,
    action: "member.invitation_revoke",
    actorId: actorUserId,
    entityType: "invitation",
    entityId: invitationId,
    metadata: { email: doc.email },
  });
}

export async function resendInvitation(actorUserId: string, orgIdOrSlug: string, invitationId: string): Promise<void> {
  await connectDb();
  const ctx = await requireOrgPermission(actorUserId, orgIdOrSlug, "invitation.manage");
  const org = await Organization.findOne({ _id: ctx.organizationId, deletedAt: null }).lean();
  if (!org) throw ApiError.notFound();
  const doc = await getPendingInvitationForOrg(ctx.organizationId, invitationId);

  if (doc.status === "accepted") throw ApiError.conflict("This invitation was already accepted.");
  if (doc.resendCount >= 5) throw ApiError.rateLimited("This invitation has been resent too many times.");
  if (doc.lastSentAt && Date.now() - doc.lastSentAt.getTime() < 60_000) {
    throw ApiError.rateLimited("Please wait a minute before resending.");
  }

  const rawToken = createRandomToken(32);
  doc.tokenHash = hashToken(rawToken);
  doc.expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
  doc.resendCount += 1;
  doc.lastSentAt = new Date();
  doc.status = "pending";
  doc.revokedAt = null;
  await doc.save();

  const inviter = (await getUserInfos([String(doc.invitedBy)])).get(String(doc.invitedBy));
  const mail = invitationTemplate({
    inviterName: inviter?.name ?? "A teammate",
    orgName: org.name,
    roleLabel: ORG_ROLE_LABELS[doc.role],
    link: appLink(`/invitations/${rawToken}`),
  });
  await sendMail({ to: doc.email, subject: mail.subject, html: mail.html, text: mail.text });
  void logActivity({
    organizationId: ctx.organizationId,
    action: "member.invitation_resend",
    actorId: actorUserId,
    entityType: "invitation",
    entityId: invitationId,
    metadata: { email: doc.email },
  });
}

/* ------------------------------------------------------------------ */
/* Accept / decline (self-service, token-based)                        */
/* ------------------------------------------------------------------ */

/** Public preview of an invitation for the accept page. */
export async function getInvitationPreview(rawToken: string): Promise<PublicInvitationInfo> {
  await connectDb();
  const doc = await Invitation.findOne({ tokenHash: hashToken(rawToken) }).lean();
  if (!doc) throw ApiError.notFound("This invitation link is invalid or has expired.");
  const now = Date.now();
  if (doc.status !== "pending") throw ApiError.conflict("This invitation is no longer active.");
  if (doc.expiresAt.getTime() < now) throw ApiError.conflict("This invitation has expired.");

  const [org, inviter] = await Promise.all([
    Organization.findOne({ _id: doc.organizationId, deletedAt: null }).select("name").lean(),
    User.findOne({ _id: doc.invitedBy }).select("name").lean(),
  ]);
  if (!org) throw ApiError.conflict("The organization that invited you no longer exists.");

  const user = await User.findOne({ email: doc.email }).select("_id").lean();
  const memberAlready = Boolean(user && (await Membership.exists({ organizationId: doc.organizationId, userId: user._id })));

  return {
    organizationName: org.name,
    inviterName: inviter?.name ?? "Someone",
    email: doc.email,
    role: doc.role,
    expiresAt: doc.expiresAt.toISOString(),
    status: "pending",
    memberAlready,
    hasAccount: Boolean(user),
  };
}

/**
 * Accept flow: the signed-in user must own the invited email.
 * Creates the membership (respecting limits) and marks the invite used.
 */
export async function acceptInvitation(
  actorUserId: string,
  rawToken: string
): Promise<{ organizationId: string; organizationName: string; role: OrgRole }> {
  await connectDb();
  const doc = await Invitation.findOne({ tokenHash: hashToken(rawToken) });
  if (!doc) throw ApiError.notFound("This invitation link is invalid or has expired.");
  const now = Date.now();

  if (doc.status === "accepted") {
    const org = await Organization.findById(doc.organizationId).select("name").lean();
    throw ApiError.conflict("This invitation has already been used.");
  }
  if (doc.status === "revoked") throw ApiError.conflict("This invitation was revoked by the organization.");
  if (doc.status === "declined") throw ApiError.conflict("This invitation was declined.");
  if (doc.expiresAt.getTime() < now) {
    doc.status = "expired";
    await doc.save();
    throw ApiError.conflict("This invitation has expired. Ask the organization to send a new one.");
  }

  const actor = await User.findById(actorUserId).where("deletedAt").equals(null).lean();
  if (!actor) throw ApiError.unauthorized();
  if (actor.email.toLowerCase() !== doc.email) {
    throw ApiError.forbidden(
      `This invitation was sent to ${doc.email}, but you're signed in as ${actor.email}. Sign in with the invited address to accept.`
    );
  }

  const org = await Organization.findOne({ _id: doc.organizationId, deletedAt: null }).lean();
  if (!org) throw ApiError.notFound("The organization no longer exists.");

  const [activeCount, already] = await Promise.all([
    Membership.countDocuments({ organizationId: doc.organizationId, status: "active" }),
    Membership.findOne({ organizationId: doc.organizationId, userId: actorUserId }).lean(),
  ]);
  const limit = PLAN_LIMITS[org.plan.key].members;
  if (!already && limit !== null && activeCount >= limit) {
    throw ApiError.planRequired(`This organization has reached its ${org.plan.key}-plan member limit (${limit}).`);
  }

  if (already) {
    if (already.status !== "active") {
      throw ApiError.forbidden("Your membership in this organization is suspended. Contact an admin.");
    }
  } else {
    await Membership.create({
      organizationId: doc.organizationId,
      userId: actorUserId,
      role: doc.role,
      status: "active",
      joinedAt: new Date(),
    });
  }

  doc.status = "accepted";
  doc.acceptedAt = new Date();
  await doc.save();

  void logActivity({
    organizationId: String(doc.organizationId),
    action: "member.invitation_accept",
    actorId: actorUserId,
    entityType: "invitation",
    entityId: String(doc._id),
    metadata: { email: doc.email, role: doc.role },
  });
  void logActivity({
    organizationId: String(doc.organizationId),
    action: "member.join",
    actorId: actorUserId,
    metadata: { via: "invitation" },
  });
  void dispatchWebhookEvent(String(doc.organizationId), "member.added", {
    organizationId: String(doc.organizationId),
    userId: actorUserId,
    email: doc.email,
    role: doc.role,
  });

  return {
    organizationId: String(doc.organizationId),
    organizationName: org.name,
    role: doc.role,
  };
}

export async function declineInvitation(actorUserId: string, rawToken: string): Promise<void> {
  await connectDb();
  const doc = await Invitation.findOne({ tokenHash: hashToken(rawToken) });
  if (!doc) throw ApiError.notFound("This invitation link is invalid or has expired.");
  if (doc.status === "accepted") throw ApiError.conflict("This invitation was already accepted.");
  if (doc.status === "declined" || doc.status === "revoked") throw ApiError.conflict("This invitation was already resolved.");

  const actor = await User.findById(actorUserId).select("email").lean();
  if (!actor || actor.email.toLowerCase() !== doc.email) {
    throw ApiError.forbidden("This invitation was not sent to your account.");
  }

  doc.status = "declined";
  doc.declinedAt = new Date();
  await doc.save();
  void logActivity({
    organizationId: String(doc.organizationId),
    action: "member.invitation_decline",
    actorId: actorUserId,
    entityType: "invitation",
    entityId: String(doc._id),
    metadata: { email: doc.email },
  });
}

export async function assertInvitationAcceptRateLimit(actorUserId: string): Promise<void> {
  await rateLimit("invite:accept", `user:${actorUserId}`, 20, 60 * 60_000);
}
