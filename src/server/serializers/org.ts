import type { OrgDTO, OrgMemberDTO, InvitationDTO } from "@/types";
import type { PlanKey, OrgRole } from "@/lib/constants";
import type { MembershipDoc } from "@/server/db/models/membership.model";
import type { Organization } from "@/server/db/models/organization.model";
import type { UserInfo } from "@/server/db/lookups";

/** Serialize a lean Organization document (+role/count from membership context). */
export function serializeOrg(
  org: {
    _id: unknown;
    name: string;
    slug: string;
    description: string | null;
    logoUrl: string | null;
    plan: { key?: PlanKey };
    settings?: { restrictProjectVisibility?: boolean; allowMemberProjects?: boolean; allowMemberChannels?: boolean };
    createdAt: Date;
  },
  myRole: OrgRole,
  memberCount: number
): OrgDTO {
  return {
    id: String(org._id),
    name: org.name,
    slug: org.slug,
    description: org.description,
    logoUrl: org.logoUrl,
    myRole,
    myStatus: "active",
    memberCount,
    plan: org.plan?.key ?? "free",
    settings: {
      restrictProjectVisibility: org.settings?.restrictProjectVisibility ?? false,
      allowMemberProjects: org.settings?.allowMemberProjects ?? false,
      allowMemberChannels: org.settings?.allowMemberChannels ?? false,
    },
    createdAt: org.createdAt.toISOString(),
  };
}

export function serializeOrgMember(
  m: {
    _id: unknown;
    role: MembershipDoc["role"];
    status: MembershipDoc["status"];
    title: MembershipDoc["title"];
    joinedAt: Date;
    lastActiveAt: Date | null;
  },
  user: UserInfo
): OrgMemberDTO {
  return {
    id: String(m._id),
    userId: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    role: m.role,
    status: m.status,
    title: m.title,
    joinedAt: m.joinedAt.toISOString(),
    lastActiveAt: m.lastActiveAt ? m.lastActiveAt.toISOString() : null,
  };
}

export function serializeInvitation(
  inv: {
    _id: unknown;
    email: string;
    role: OrgRole;
    status: string;
    expiresAt: Date;
    invitedAt: Date;
    acceptedAt: Date | null;
    resendCount: number;
  },
  invitedByName: string
): InvitationDTO {
  const now = Date.now();
  return {
    id: String(inv._id),
    email: inv.email,
    role: inv.role,
    status: inv.status === "pending" && inv.expiresAt.getTime() < now ? "expired" : inv.status,
    invitedByName,
    invitedAt: inv.invitedAt.toISOString(),
    expiresAt: inv.expiresAt.toISOString(),
    canResend: inv.status === "pending" && inv.expiresAt.getTime() > now && inv.resendCount < 5,
    acceptedAt: inv.acceptedAt ? inv.acceptedAt.toISOString() : null,
  };
}

export type { Organization };
