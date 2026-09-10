/** Central query-key factory. Feature queries are keyed by org so that
 * switching tenants invalidates everything with one bump. */
export const qk = {
  me: ["me"] as const,
  session: ["session"] as const,
  orgList: ["orgs"] as const,
  orgDetail: (orgId: string) => ["org", orgId] as const,
  members: (orgId: string) => ["members", orgId] as const,
  invitations: (orgId: string) => ["invitations", orgId] as const,
  projects: (orgId: string, extra?: string) => ["projects", orgId, extra ?? "all"] as const,
  project: (orgId: string, projectId: string) => ["project", orgId, projectId] as const,
  board: (orgId: string, projectId: string, extra?: string) =>
    ["board", orgId, projectId, extra ?? "all"] as const,
  tasks: (orgId: string, projectId: string, extra?: string) =>
    ["tasks", orgId, projectId, extra ?? "all"] as const,
  task: (orgId: string, projectId: string, taskId: string) =>
    ["task", orgId, projectId, taskId] as const,
  comments: (orgId: string, projectId: string, taskId: string) =>
    ["comments", orgId, projectId, taskId] as const,
  sprints: (orgId: string, projectId: string) => ["sprints", orgId, projectId] as const,
  sprint: (orgId: string, projectId: string, sprintId: string) =>
    ["sprint", orgId, projectId, sprintId] as const,
  milestones: (orgId: string, projectId: string) => ["milestones", orgId, projectId] as const,
  notifications: (orgId: string) => ["notifications", orgId] as const,
  unreadCount: (orgId: string) => ["notifications", orgId, "count"] as const,
  activity: (orgId: string, extra?: string) => ["activity", orgId, extra ?? "all"] as const,
  conversations: (orgId: string) => ["conversations", orgId] as const,
  messages: (orgId: string, conversationId: string) =>
    ["messages", orgId, conversationId] as const,
  presence: (orgId: string) => ["presence", orgId] as const,
  runningTimer: (orgId: string) => ["runningTimer", orgId] as const,
  timeReport: (orgId: string, extra?: string) => ["time", orgId, "report", extra ?? "all"] as const,
  timeEntries: (orgId: string, projectId: string, taskId: string) =>
    ["timeEntries", orgId, projectId, taskId] as const,
  calendar: (orgId: string, from: string, to: string) => ["calendar", orgId, from, to] as const,
  files: (orgId: string, extra?: string) => ["files", orgId, extra ?? "all"] as const,
  analyticsSummary: (orgId: string) => ["analytics", orgId, "summary"] as const,
  analyticsTrends: (orgId: string, days: number) => ["analytics", orgId, "trends", days] as const,
  analyticsDistributions: (orgId: string) => ["analytics", orgId, "distributions"] as const,
  analyticsWorkload: (orgId: string) => ["analytics", orgId, "workload"] as const,
  aiUsage: (orgId: string) => ["aiUsage", orgId] as const,
  search: (orgId: string, q: string) => ["search", orgId, q] as const,
  webhooks: (orgId: string) => ["webhooks", orgId] as const,
  webhookDeliveries: (orgId: string, endpointId?: string) =>
    ["webhooks", orgId, "deliveries", endpointId ?? "all"] as const,
};
