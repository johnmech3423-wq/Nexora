/* ------------------------------------------------------------------ */
/* Permission assertions — the ONLY place authorization rules live.    */
/* Services call these; components never inline their own checks.      */
/* ------------------------------------------------------------------ */
import { ApiError } from "@/server/errors";
import {
  orgRoleHasPermission,
  projectRoleHasPermission,
  type OrgPermissionKey,
  type ProjectPermissionKey,
} from "@/lib/permissions";
import type { OrgRole, MemberStatus } from "@/lib/constants";
import { resolveOrgContext, resolveProjectAccess } from "./context";

export { resolveOrgContext };

/** Read-only view perms that any org member may exercise on non-private projects. */
const READ_PERMS: ProjectPermissionKey[] = ["project.read", "task.read", "calendar.read"];

export async function assertOrgPermission(
  userId: string,
  orgIdOrSlug: string,
  permission: OrgPermissionKey
): Promise<{ organizationId: string }> {
  const ctx = await resolveOrgContext(userId, orgIdOrSlug);
  if (!orgRoleHasPermission(ctx.role, permission)) {
    throw ApiError.forbidden();
  }
  return ctx;
}

/**
 * Full authorization for a project-scoped operation:
 *  - org membership required (404 otherwise)
 *  - owner/admin → granted (org-wide admin)
 *  - explicit project role → role table decides
 *  - read-only perms on non-private projects → org members allowed
 */
export async function assertProjectPermission(
  userId: string,
  projectId: string,
  permission: ProjectPermissionKey
): Promise<{
  organizationId: string;
  orgRole: OrgRole;
  projectId: string;
  archived: boolean;
}> {
  const { access, membershipActive } = await resolveProjectAccess(userId, projectId);
  const { orgRole, projectRole, project } = access;

  const isOrgAdmin = orgRole === "owner" || orgRole === "admin";
  const allowed =
    isOrgAdmin ||
    (projectRole !== null &&
      projectRoleHasPermission(projectRole, permission) &&
      orgRoleHasPermission(orgRole, permission as OrgPermissionKey)) ||
    (!project.settings.private && READ_PERMS.includes(permission) && orgRoleHasPermission(orgRole, "project.read"));

  if (!allowed) throw ApiError.forbidden();
  if (!membershipActive) throw ApiError.forbidden("Your membership in this organization is suspended.");
  if (project.archivedAt && (permission === "task.create" || permission === "task.update" || permission === "project.update")) {
    throw ApiError.conflict("This project is archived. Restore it before making changes.");
  }

  return { organizationId: access.organizationId, orgRole, projectId: project._id, archived: Boolean(project.archivedAt) };
}

/** Convenience: org-scoped role of user (for role-specific business rules). */
export async function getOrgRole(userId: string, organizationId: string): Promise<OrgRole> {
  const ctx = await resolveOrgContext(userId, organizationId);
  return ctx.role;
}

/** Convenience: active membership status. */
export async function requireActiveMembership(userId: string, organizationId: string): Promise<{ organizationId: string }> {
  const ctx = await resolveOrgContext(userId, organizationId);
  return { organizationId: ctx.organizationId };
}

export function requireMemberStatusActive(status: MemberStatus): void {
  if (status !== "active") throw ApiError.forbidden("Your membership is suspended.");
}
