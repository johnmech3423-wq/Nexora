/**
 * Canonical list of activity-log action keys used across services.
 * Every call to logActivity should use one of these keys so the audit
 * trail stays consistent and queryable.
 */
export const TRACKED_ACTIONS = new Set<string>([
  // auth
  "auth.login",
  "auth.logout",
  "auth.register",
  "auth.verify_email",
  "auth.reset_password",
  "auth.two_factor_enabled",
  "auth.two_factor_disabled",
  "session.revoked",
  "user.password_changed",
  // organizations
  "org.create",
  "org.update",
  "org.settings.update",
  "org.delete",
  "org.transfer_ownership",
  "member.invite",
  "member.invitation_resend",
  "member.invitation_revoke",
  "member.invitation_accept",
  "member.invitation_decline",
  "member.join",
  "member.leave",
  "member.remove",
  "member.role_update",
  "member.status_update",
  // projects
  "project.create",
  "project.update",
  "project.archive",
  "project.restore",
  "project.delete",
  "project.member_add",
  "project.member_remove",
  "project.member_role_update",
  "project.label_create",
  "project.status_update",
  "project.favorite",
  // tasks
  "task.create",
  "task.update",
  "task.status_change",
  "task.move",
  "task.assign",
  "task.delete",
  "task.restore",
  "task.watch",
  "task.sprint_change",
  "task.milestone_change",
  "task.subtask_add",
  // comments
  "comment.create",
  "comment.update",
  "comment.delete",
  // sprints
  "sprint.create",
  "sprint.update",
  "sprint.start",
  "sprint.complete",
  "sprint.cancel",
  // milestones
  "milestone.create",
  "milestone.update",
  "milestone.delete",
  "milestone.complete",
  // files
  "file.upload",
  "file.delete",
  // chat
  "chat.conversation_create",
  "chat.message_delete",
  // settings/security
  "settings.update",
  "webhook.create",
  "webhook.update",
  "webhook.delete",
  "billing.plan_update",
  "billing.subscription_update",
  "notification.prefs_update",
]);
