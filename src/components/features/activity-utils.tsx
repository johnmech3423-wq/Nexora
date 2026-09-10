import { Avatar } from "@/components/ui/avatar";
import { timeAgo, cn } from "@/lib/utils";
import type { ActivityDTO } from "@/types";

const ACTION_LABELS: Record<string, string> = {
  "auth.login": "signed in",
  "auth.register": "created an account",
  "auth.verify_email": "verified their email",
  "org.create": "created the workspace",
  "org.update": "updated the workspace",
  "org.settings.update": "updated workspace settings",
  "member.invite": "invited a new member",
  "member.invitation_accept": "joined the workspace",
  "member.join": "joined the workspace",
  "member.remove": "removed a member",
  "member.role_update": "changed a member's role",
  "member.status_update": "changed a member's status",
  "project.create": "created a project",
  "project.update": "updated a project",
  "project.archive": "archived a project",
  "project.restore": "restored a project",
  "project.delete": "deleted a project",
  "project.member_add": "added a member to a project",
  "project.member_remove": "removed a member from a project",
  "project.label_create": "created a project label",
  "project.status_update": "updated project statuses",
  "project.favorite": "starred a project",
  "task.create": "created a task",
  "task.update": "updated a task",
  "task.status_change": "moved a task",
  "task.move": "moved a task",
  "task.assign": "assigned a task",
  "task.delete": "deleted a task",
  "task.watch": "changed task watching",
  "task.sprint_change": "changed a task's sprint",
  "task.milestone_change": "changed a task's milestone",
  "task.subtask_add": "added a subtask",
  "comment.create": "commented",
  "comment.update": "edited a comment",
  "comment.delete": "deleted a comment",
  "sprint.create": "created a sprint",
  "sprint.update": "updated a sprint",
  "sprint.start": "started a sprint",
  "sprint.complete": "completed a sprint",
  "sprint.cancel": "cancelled a sprint",
  "milestone.create": "created a milestone",
  "milestone.update": "updated a milestone",
  "milestone.delete": "deleted a milestone",
  "file.upload": "uploaded a file",
  "file.delete": "deleted a file",
  "time_entry.start": "started a timer",
  "time_entry.stop": "stopped a timer",
  "time_entry.delete": "removed a time entry",
  "chat.group_create": "created a group chat",
  "chat.message": "sent a chat message",
  "webhook.create": "created a webhook",
  "webhook.update": "updated a webhook",
  "webhook.delete": "deleted a webhook",
  "webhook.retry": "retried a webhook delivery",
  "org.plan_update": "changed the workspace plan",
  "notification.prefs_update": "updated notification preferences",
};

export function describeAction(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/\./g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function entityLabel(entityType: string | null, metadata: Record<string, unknown> | null): string {
  const meta = metadata ?? {};
  if (entityType === "task" && typeof meta.title === "string") return `“${meta.title.slice(0, 60)}”`;
  if (entityType === "project" && typeof meta.name === "string") return `“${meta.name}”`;
  if (entityType === "sprint" && typeof meta.name === "string") return `“${meta.name}”`;
  if (entityType === "comment") return "a comment";
  if (entityType === "milestone") return "a milestone";
  if (entityType === "membership" || entityType === "invitation") return "membership";
  if (entityType === "webhook") return "a webhook";
  if (entityType === "organization") return "the workspace";
  return entityType ? entityType.replace(/_/g, " ") : "";
}

export function ActivityItem({ entry, compact }: { entry: ActivityDTO; compact?: boolean }) {
  return (
    <div className={cn("flex items-start gap-3 py-2.5", compact && "py-2")}>
      <Avatar name={entry.actor?.name ?? null} src={entry.actor?.avatarUrl} size="sm" className="mt-0.5" />
      <div className="min-w-0 flex-1 text-[13px] leading-snug">
        <p>
          <span className="font-medium">{entry.actor?.name ?? "A member"}</span>{" "}
          <span className="text-muted-foreground">{describeAction(entry.action)}</span>{" "}
          {entityLabel(entry.entityType, entry.metadata) ? (
            <span className="text-muted-foreground">{entityLabel(entry.entityType, entry.metadata)}</span>
          ) : null}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{timeAgo(entry.createdAt)}</p>
      </div>
    </div>
  );
}
