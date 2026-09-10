/**
 * Domain constants shared across server & client. Values that carry UI
 * metadata (labels/colors) intentionally live here so both sides agree.
 */

export const APP_NAME = "Nexora";

/* ------------------------------------------------------------------ */
/* Organizations                                                       */
/* ------------------------------------------------------------------ */
export const ORG_ROLES = ["owner", "admin", "member", "guest"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export const MEMBER_STATUSES = ["active", "suspended"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export const INVITATION_STATUSES = [
  "pending",
  "accepted",
  "declined",
  "revoked",
  "expired",
] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const ORG_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/;
export const ORG_ROLE_LABELS: Record<OrgRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  guest: "Guest",
};

/* ------------------------------------------------------------------ */
/* Tasks                                                               */
/* ------------------------------------------------------------------ */
export interface StatusMeta {
  key: string;
  label: string;
  color: string; // hex
  /** order of the status group used when a project defines no custom order */
  index: number;
  terminal?: boolean;
}

export const DEFAULT_STATUSES: StatusMeta[] = [
  { key: "backlog", label: "Backlog", color: "#94a3b8", index: 0 },
  { key: "todo", label: "To Do", color: "#38bdf8", index: 1 },
  { key: "in_progress", label: "In Progress", color: "#8b5cf6", index: 2 },
  { key: "in_review", label: "In Review", color: "#f59e0b", index: 3 },
  { key: "done", label: "Done", color: "#22c55e", index: 4, terminal: true },
];

export const DONE_STATUS_KEY = "done";

export interface PriorityMeta {
  key: TaskPriority;
  label: string;
  rank: number;
  color: string;
}

export const PRIORITIES: PriorityMeta[] = [
  { key: "none", label: "No priority", rank: 0, color: "#94a3b8" },
  { key: "low", label: "Low", rank: 1, color: "#38bdf8" },
  { key: "medium", label: "Medium", rank: 2, color: "#f59e0b" },
  { key: "high", label: "High", rank: 3, color: "#f97316" },
  { key: "urgent", label: "Urgent", rank: 4, color: "#ef4444" },
];

export const TASK_PRIORITIES = ["none", "low", "medium", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export function priorityMeta(key: string): PriorityMeta {
  return PRIORITIES.find((p) => p.key === key) ?? PRIORITIES[0]!;
}

export function statusMeta(key: string): StatusMeta {
  return DEFAULT_STATUSES.find((s) => s.key === key) ?? { key, label: key, color: "#94a3b8", index: 99 };
}

/* ------------------------------------------------------------------ */
/* Sprints & milestones                                                */
/* ------------------------------------------------------------------ */
export const SPRINT_STATUSES = ["planned", "active", "completed", "cancelled"] as const;
export type SprintStatus = (typeof SPRINT_STATUSES)[number];

/* ------------------------------------------------------------------ */
/* Notification types & preference topics                              */
/* ------------------------------------------------------------------ */
export const NOTIFICATION_TYPES = [
  "mention",
  "task_assigned",
  "task_update",
  "comment",
  "invitation",
  "project_activity",
  "sprint_event",
  "chat_message",
  "deadline_reminder",
  "system",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_PREF_KEYS = [
  "mentions",
  "task_assignments",
  "comments",
  "project_updates",
  "sprint_events",
  "chat_messages",
  "deadline_reminders",
  "invitations",
] as const;
export type NotificationPrefKey = (typeof NOTIFICATION_PREF_KEYS)[number];

/* ------------------------------------------------------------------ */
/* Chat                                                                */
/* ------------------------------------------------------------------ */
export const CONVERSATION_TYPES = ["dm", "group", "project_channel"] as const;
export type ConversationType = (typeof CONVERSATION_TYPES)[number];

export const MESSAGE_TYPES = ["text", "system"] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

export const REACTION_EMOJIS = [
  "👍", "👎", "😄", "🎉", "😕", "❤️", "🚀", "👀",
] as const;

/* ------------------------------------------------------------------ */
/* Files                                                               */
/* ------------------------------------------------------------------ */
export const FILE_KINDS = [
  "avatar",
  "task_attachment",
  "comment_attachment",
  "project_file",
  "message_attachment",
] as const;
export type FileKind = (typeof FILE_KINDS)[number];

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_MIME_PREFIXES = [
  "image/",
  "text/",
  "application/pdf",
  "application/json",
  "application/xml",
  "application/zip",
  "application/gzip",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.",
  "application/vnd.ms-",
  "application/x-tar",
  "text/csv",
];

export const IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/svg+xml",
];

/* ------------------------------------------------------------------ */
/* Plans & limits (single source of truth — enforced server-side)      */
/* ------------------------------------------------------------------ */
export const PLANS = ["free", "pro", "business"] as const;
export type PlanKey = (typeof PLANS)[number];

export interface PlanLimits {
  members: number | null; // null = unlimited
  projects: number | null;
  storageMb: number | null;
  aiRequestsPerMemberPerDay: number;
  advancedAnalytics: boolean;
  webhooks: number;
  timeTracking: boolean;
  sprints: boolean;
}

export const PLAN_LIMITS: Record<PlanKey, PlanLimits> = {
  free: {
    members: 5,
    projects: 3,
    storageMb: 200,
    aiRequestsPerMemberPerDay: 0,
    advancedAnalytics: false,
    webhooks: 0,
    timeTracking: false,
    sprints: true,
  },
  pro: {
    members: 25,
    projects: 30,
    storageMb: 10_000,
    aiRequestsPerMemberPerDay: 30,
    advancedAnalytics: true,
    webhooks: 5,
    timeTracking: true,
    sprints: true,
  },
  business: {
    members: null,
    projects: null,
    storageMb: 100_000,
    aiRequestsPerMemberPerDay: 100,
    advancedAnalytics: true,
    webhooks: 50,
    timeTracking: true,
    sprints: true,
  },
};

export const PLAN_PRICING: Record<PlanKey, { monthly: number | null; tagline: string }> = {
  free: { monthly: 0, tagline: "For small teams getting started" },
  pro: { monthly: 12, tagline: "For growing teams that need power" },
  business: { monthly: 29, tagline: "For organizations at scale" },
};

export const DEFAULT_PLAN: PlanKey = "free";

/* ------------------------------------------------------------------ */
/* Webhooks                                                           */
/* ------------------------------------------------------------------ */
export const WEBHOOK_EVENT_KEYS = [
  "task.created",
  "task.updated",
  "task.deleted",
  "comment.created",
  "project.created",
  "project.updated",
  "project.deleted",
  "sprint.updated",
  "member.added",
  "member.removed",
] as const;
export type WebhookEventKey = (typeof WEBHOOK_EVENT_KEYS)[number];

/* ------------------------------------------------------------------ */
/* Time tracking                                                       */
/* ------------------------------------------------------------------ */
export const TIME_ENTRY_MAX_MS = 24 * 60 * 60 * 1000; // cap a manual entry at 24h

/* ------------------------------------------------------------------ */
/* Generic                                                             */
/* ------------------------------------------------------------------ */
export const PAGE_SIZE_DEFAULT = 20;
export const PAGE_SIZE_MAX = 100;

export type ApiErrorCode =
  | "validation_error"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "plan_required"
  | "unprocessable"
  | "server_error"
  | "external_unavailable";
