/* ------------------------------------------------------------------ */
/* Tenant-resolution & authorization context.                          */
/*                                                                     */
/* Rules enforced across every service:                                */
/*   1. All tenant-scoped queries resolve the tenant from the          */
/*      *authenticated user* — the client-supplied org id/slug is only */
/*      a lookup hint. Membership is verified server-side every time.  */
/*   2. Org admins/owners hold every project-level grant inside their  */
/*      organization (they can administer any project).                */
/*   3. Outsiders get 404, not 403, so org existence cannot be probed. */
/* ------------------------------------------------------------------ */
import { connectDb, isObjectId } from "@/server/db/db";
import { Organization } from "@/server/db/models/organization.model";
import { Membership } from "@/server/db/models/membership.model";
import { Project } from "@/server/db/models/project.model";
import { ProjectMember } from "@/server/db/models/project-member.model";
import { notFoundOrUnauthorized } from "@/server/errors";
import type { OrgRole } from "@/lib/constants";
import type { ProjectRole } from "@/lib/permissions";

export interface OrgContext {
  organizationId: string;
  role: OrgRole;
}

/**
 * Verifies the user holds an active membership for the org (by id or
 * slug) and returns the minimal context. 404 on any failure.
 */
export async function resolveOrgContext(userId: string, orgIdOrSlug: string): Promise<OrgContext> {
  await connectDb();
  const isId = isObjectId(orgIdOrSlug);

  const organization = isId
    ? await Organization.findOne({ _id: orgIdOrSlug, deletedAt: null }).select("_id").lean()
    : await Organization.findOne({ slug: orgIdOrSlug.toLowerCase(), deletedAt: null }).select("_id").lean();
  if (!organization) notFoundOrUnauthorized();

  const membership = await Membership.findOne({ organizationId: organization._id, userId, status: "active" })
    .select("role")
    .lean();
  if (!membership) notFoundOrUnauthorized();

  return { organizationId: String(organization._id), role: membership.role };
}

export interface ProjectAccess {
  organizationId: string;
  orgRole: OrgRole;
  project: {
    _id: string;
    organizationId: string;
    settings: { private: boolean };
    archivedAt: Date | null;
  };
  projectRole: ProjectRole | null;
  orgRoleLabel: OrgRole;
}

/**
 * Loads a project + the caller's membership levels. Callers combine
 * this with assertProjectPermission (guard.ts) before acting.
 */
export async function resolveProjectAccess(
  userId: string,
  projectId: string
): Promise<{ access: ProjectAccess; membershipActive: boolean }> {
  await connectDb();
  if (!isObjectId(projectId)) notFoundOrUnauthorized();

  const project = await Project.findOne({ _id: projectId, deletedAt: null })
    .select("organizationId settings.private archivedAt")
    .lean();
  if (!project) notFoundOrUnauthorized();

  const membership = await Membership.findOne({
    organizationId: project.organizationId,
    userId,
  })
    .select("role status")
    .lean();
  if (!membership) notFoundOrUnauthorized();

  const projectMembership = await ProjectMember.findOne({ projectId, userId }).select("role").lean();

  return {
    access: {
      organizationId: String(project.organizationId),
      orgRole: membership.role,
      project: {
        _id: String(project._id),
        organizationId: String(project.organizationId),
        settings: { private: project.settings?.private ?? false },
        archivedAt: project.archivedAt,
      },
      projectRole: projectMembership?.role ?? null,
      orgRoleLabel: membership.role,
    },
    membershipActive: membership.status === "active",
  };
}
