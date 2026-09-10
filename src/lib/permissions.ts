/* ------------------------------------------------------------------ */
/* Permission registry — SHARED between client (UI gating) and server. */
/* Server-side enforcement lives in src/server/authorization/guard.ts. */
/* This table is the single source of truth for what each role may do. */
/* ------------------------------------------------------------------ */
import type { OrgRole } from "@/lib/constants";

/** Organization-scoped permission keys. */
export const ORG_PERMISSION_KEYS = [
  "org.read",
  "org.update",
  "member.read",
  "member.invite",
  "member.remove",
  "member.updateRole",
  "invitation.manage",
  "project.create",
  "project.read",
  "project.update",
  "project.delete",
  "project.archive",
  "project.manageMembers",
  "task.read",
  "task.create",
  "task.update",
  "task.delete",
  "task.assign",
  "task.comment",
  "task.attach",
  "comment.delete",
  "sprint.manage",
  "milestone.manage",
  "calendar.read",
  "calendar.update",
  "analytics.read",
  "chat.read",
  "chat.send",
  "chat.manage",
  "file.upload",
  "file.delete",
  "time.track",
  "settings.manage",
  "billing.manage",
  "webhook.manage",
  "activity.read",
  "ai.use",
] as const;

export type OrgPermissionKey = (typeof ORG_PERMISSION_KEYS)[number];

const ALL: OrgRole[] = ["owner", "admin", "member", "guest"];

/** Org role → allowed org-scoped permissions. */
const ORG_ROLE_PERMISSIONS: Record<OrgRole, readonly OrgPermissionKey[]> = {
  owner: ORG_PERMISSION_KEYS, // owners hold every org permission
  admin: [
    "org.read",
    "org.update",
    "member.read",
    "member.invite",
    "member.remove",
    "member.updateRole",
    "invitation.manage",
    "project.create",
    "project.read",
    "project.update",
    "project.delete",
    "project.archive",
    "project.manageMembers",
    "task.read",
    "task.create",
    "task.update",
    "task.delete",
    "task.assign",
    "task.comment",
    "task.attach",
    "comment.delete",
    "sprint.manage",
    "milestone.manage",
    "calendar.read",
    "calendar.update",
    "analytics.read",
    "chat.read",
    "chat.send",
    "chat.manage",
    "file.upload",
    "file.delete",
    "time.track",
    "settings.manage",
    "webhook.manage",
    "activity.read",
    "ai.use",
    // billing.manage deliberately excluded — owner only
  ],
  member: [
    "org.read",
    "member.read",
    "project.read",
    "project.create",
    "task.read",
    "task.create",
    "task.update",
    "task.delete",
    "task.assign",
    "task.comment",
    "task.attach",
    "comment.delete",
    "calendar.read",
    "calendar.update",
    "analytics.read",
    "chat.read",
    "chat.send",
    "file.upload",
    "file.delete",
    "time.track",
    "activity.read",
    "ai.use",
  ],
  guest: [
    "org.read",
    "project.read",
    "task.read",
    "task.comment",
    "calendar.read",
    "chat.read",
    "chat.send",
  ],
};

/* ------------------------------------------------------------------ */
/* Project-scoped roles & permissions                                  */
/* ------------------------------------------------------------------ */
export const PROJECT_ROLES = ["manager", "member", "viewer"] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

export const PROJECT_PERMISSION_KEYS = [
  "project.read",
  "project.update",
  "project.archive",
  "project.delete",
  "project.manageMembers",
  "task.read",
  "task.create",
  "task.update",
  "task.delete",
  "task.assign",
  "task.comment",
  "task.attach",
  "comment.delete",
  "sprint.manage",
  "milestone.manage",
  "calendar.read",
  "calendar.update",
  "analytics.read",
  "chat.read",
  "chat.send",
  "chat.manage",
  "file.upload",
  "file.delete",
  "time.track",
  "ai.use",
] as const;

export type ProjectPermissionKey = (typeof PROJECT_PERMISSION_KEYS)[number];

/** Project role → allowed project-scoped permissions. */
const PROJECT_ROLE_PERMISSIONS: Record<ProjectRole, readonly ProjectPermissionKey[]> = {
  manager: PROJECT_PERMISSION_KEYS,
  member: [
    "project.read",
    "task.read",
    "task.create",
    "task.update",
    "task.delete",
    "task.assign",
    "task.comment",
    "task.attach",
    "comment.delete",
    "calendar.read",
    "calendar.update",
    "analytics.read",
    "chat.read",
    "chat.send",
    "file.upload",
    "file.delete",
    "time.track",
    "ai.use",
  ],
  viewer: ["project.read", "task.read", "calendar.read", "chat.read"],
};

/** Returns every permission key granted to an org role. */
export function orgRolePermissions(role: OrgRole): readonly OrgPermissionKey[] {
  return ORG_ROLE_PERMISSIONS[role];
}

export function orgRoleHasPermission(role: OrgRole, permission: OrgPermissionKey): boolean {
  return ORG_ROLE_PERMISSIONS[role].includes(permission);
}

/** Returns every permission key granted to a project role. */
export function projectRolePermissions(role: ProjectRole): readonly ProjectPermissionKey[] {
  return PROJECT_ROLE_PERMISSIONS[role];
}

export function projectRoleHasPermission(role: ProjectRole, permission: ProjectPermissionKey): boolean {
  return PROJECT_ROLE_PERMISSIONS[role].includes(permission);
}

export const PROJECT_ROLE_LABELS: Record<ProjectRole, string> = {
  manager: "Manager",
  member: "Member",
  viewer: "Viewer",
};

export type { OrgPermissionKey as PermissionKey };
