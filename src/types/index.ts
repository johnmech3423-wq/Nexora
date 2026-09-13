/**
 * Shared domain types + API envelope contracts.
 * Keep in sync with server serializers (src/server/serializers) & models.
 */
import type { OrgRole, PlanKey } from "@/lib/constants";

/* ---------------- API envelope ---------------- */
export interface ApiErrorBody {
  code: string;
  message: string;
  /** field-level errors from zod validation: { field: [messages] } */
  fieldErrors?: Record<string, string[]>;
  details?: unknown;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiFailure {
  success: false;
  error: ApiErrorBody;
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export interface Paginated<T> {
  items: T[];
  meta: PageMeta;
}

/* ---------------- Users ---------------- */
export interface UserDTO {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  hasPassword: boolean;
  twoFactorEnabled: boolean;
  createdAt: string;
  role: "user";
  isPlatformAdmin: boolean;
  provider: "email" | "google" | "github" | "oauth";
  lastLoginAt: string | null;
  timezone: string | null;
  prefs: UserPrefsDTO;
}

export interface UserPrefsDTO {
  notifications: {
    emailEnabled: boolean;
    inAppEnabled: boolean;
    topics: Record<string, boolean>;
  };
  locale: string;
}

export interface SessionDTO {
  id: string;
  userAgent: string;
  ip: string;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  current: boolean;
}

export interface SessionBundle {
  user: UserDTO;
  sessionId: string;
  expiresAt: string;
}

/* ---------------- Organizations ---------------- */
export interface OrgDTO {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  myRole: OrgRole;
  myStatus: string;
  memberCount: number;
  plan: PlanKey;
  settings: {
    restrictProjectVisibility: boolean;
    allowMemberProjects: boolean;
    allowMemberChannels: boolean;
  };
  createdAt: string;
}

export interface OrgSwitchDTO {
  organizations: OrgDTO[];
  memberships: Record<string, string>; // orgId -> role (convenience)
}

export interface OrgMemberDTO {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: OrgRole;
  status: string;
  title: string | null;
  joinedAt: string;
  lastActiveAt: string | null;
}

export interface InvitationDTO {
  id: string;
  email: string;
  role: OrgRole;
  status: string;
  invitedByName: string;
  invitedAt: string;
  expiresAt: string;
  canResend: boolean;
  acceptedAt: string | null;
}

/* ---------------- Projects ---------------- */
export interface ProjectStatusDTO {
  key: string;
  label: string;
  color: string;
  index: number;
}

export interface ProjectMemberDTO {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: "manager" | "member" | "viewer";
  orgRole: OrgRole;
  taskCount?: number;
  addedAt: string;
}

export interface ProjectSummaryDTO {
  id: string;
  key: string;
  name: string;
  description: string | null;
  color: string | null;
  statuses: ProjectStatusDTO[];
  status: "active" | "archived";
  startDate: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  ownerName: string | null;
  memberCount: number;
  openTasks: number;
  completedTasks: number;
  progress: number; // 0..100
  overdueTasks: number;
  upcomingDeadline: string | null;
  myRole: "manager" | "member" | "viewer" | "none";
  isFavorite?: boolean;
  sprintCount?: number;
}

export interface ProjectDetailDTO extends ProjectSummaryDTO {
  members: ProjectMemberDTO[];
  labels: (TaskLabelDTO & { used: number })[];
}

/* ---------------- Tasks ---------------- */
export interface TaskLabelDTO {
  id: string;
  name: string;
  color: string;
}

export interface SubtaskDTO {
  id: string;
  title: string;
  status: string;
  assigneeId: string | null;
  dueDate: string | null;
  priority: string;
  hasChildren: boolean;
  order: number;
}

export interface TaskWatcherDTO {
  userId: string;
  name: string;
  avatarUrl: string | null;
}

export interface TaskDTO {
  id: string;
  projectId: string;
  projectKey: string;
  number: number;
  key: string; // e.g. NEX-104
  title: string;
  description: string;
  status: string;
  priority: string;
  assignee: AssigneeDTO | null;
  reporter: AssigneeDTO | null;
  dueDate: string | null;
  startDate: string | null;
  estimateMin: number | null;
  labels: TaskLabelDTO[];
  order: number;
  parentId: string | null;
  subtasks: SubtaskDTO[];
  completedSubtaskCount: number;
  subtaskCount: number;
  sprintId: string | null;
  milestoneId: string | null;
  watchers: TaskWatcherDTO[];
  isWatching: boolean;
  commentCount: number;
  attachmentCount: number;
  totalTrackedMs: number;
  createdAt: string;
  updatedAt: string;
  doneAt: string | null;
  createdBy: AssigneeDTO | null;
}

export interface AssigneeDTO {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface BoardColumnDTO {
  key: string;
  label: string;
  color: string;
  taskCount: number;
}

export interface BoardDTO {
  project: { id: string; name: string; key: string };
  statuses: BoardColumnDTO[];
  tasks: TaskDTO[]; // tasks carry status+order
  truncated?: boolean;
  myPermissions: { canCreate: boolean; canUpdate: boolean; canAssign: boolean };
}

export interface CommentDTO {
  id: string;
  taskId: string;
  parentId: string | null;
  author: AssigneeDTO;
  body: string;
  mentions: string[];
  reactions: ReactionDTO[];
  editedAt: string | null;
  createdAt: string;
  replyCount: number;
  canEdit: boolean;
  canDelete: boolean;
}

export interface ReactionDTO {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}

/* ---------------- Sprints ---------------- */
export interface SprintDTO {
  id: string;
  projectId: string;
  name: string;
  goal: string | null;
  status: "planned" | "active" | "completed" | "cancelled";
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  completedAt: string | null;
  taskCount: number;
  completedTaskCount: number;
  totalPoints?: number; // computed from estimateMin sum
}

/* ---------------- Milestones ---------------- */
export interface MilestoneDTO {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  dueDate: string | null;
  createdAt: string;
  completedAt: string | null;
  status: "planned" | "active" | "completed" | "overdue";
  progress: number;
  taskCount: number;
  completedTaskCount: number;
}

/* ---------------- Comments / activity / notifications ---------------- */
export interface ActivityDTO {
  id: string;
  action: string;
  actor: AssigneeDTO | null;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface NotificationDTO {
  id: string;
  type: string;
  title: string;
  body: string | null;
  actor: AssigneeDTO | null;
  link: string | null;
  read: boolean;
  createdAt: string;
}

/* ---------------- Chat ---------------- */
export interface ConversationDTO {
  id: string;
  type: "dm" | "group" | "project_channel";
  name: string;
  iconUrl: string | null;
  members: AssigneeDTO[];
  unreadCount: number;
  lastMessage: MessageSummaryDTO | null;
  createdAt: string;
  projectId: string | null;
}

export interface MessageDTO {
  id: string;
  conversationId: string;
  sender: AssigneeDTO;
  body: string;
  type: string;
  parent: MessageSummaryDTO | null;
  reactions: ReactionDTO[];
  mentions: string[];
  attachments: FileMetaDTO[];
  editedAt: string | null;
  createdAt: string;
  canEdit: boolean;
  canDelete: boolean;
}

export interface MessageSummaryDTO {
  id: string;
  senderName: string;
  senderAvatarUrl: string | null;
  body: string;
  createdAt: string;
}

/* ---------------- Files ---------------- */
export interface FileMetaDTO {
  id: string;
  name: string;
  mime: string;
  size: number;
  url: string;
  isImage: boolean;
  width?: number;
  height?: number;
  uploadedByName: string;
  createdAt: string;
  kind: string;
  ownerType: string | null;
  ownerId: string | null;
  canDelete: boolean;
}

/* ---------------- Time tracking ---------------- */
export interface TimeEntryDTO {
  id: string;
  taskId: string;
  taskKey: string;
  taskTitle: string;
  projectId: string;
  projectName: string;
  user: AssigneeDTO;
  description: string | null;
  startAt: string;
  endAt: string | null;
  durationMs: number;
  source: "timer" | "manual";
  canDelete: boolean;
}

/* ---------------- Analytics ---------------- */
export interface AnalyticsSummaryDTO {
  projects: { total: number; active: number; archived: number; completed: number };
  tasks: {
    total: number;
    open: number;
    completed: number;
    overdue: number;
    completionRate: number;
    avgCycleDays: number | null;
  };
  members: { total: number; activeToday: number };
  activity: { last24h: number };
  sprints: { total: number; active: number; completed: number };
  teamVelocity?: { projectId: string; projectName: string; velocity: number; lastSprintDate: string | null }[];
}

export interface TrendPoint {
  date: string;
  completed: number;
  created: number;
  overdue: number;
}

export interface PriorityDist {
  priority: string;
  count: number;
}

export interface StatusDist {
  status: string;
  label: string;
  color: string;
  count: number;
}

export interface WorkloadPoint {
  user: AssigneeDTO;
  open: number;
  inProgress: number;
  completed: number;
  overdue: number;
  totalTrackedMs: number;
}

export interface BurndownPoint {
  date: string;
  remaining: number;
  ideal: number;
}

/* ---------------- Webhooks ---------------- */
export interface WebhookEndpointDTO {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  createdAt: string;
  lastDeliveryAt: string | null;
  lastStatus: string | null;
  deliveryCount: number;
}

export interface WebhookDeliveryDTO {
  id: string;
  event: string;
  status: string;
  attempts: number;
  statusCode: number | null;
  lastError: string | null;
  createdAt: string;
}

/* ---------------- AI ---------------- */
export interface AiUsageDTO {
  remainingToday: number;
  limitPerDay: number;
  enabled: boolean;
  provider: string;
}
