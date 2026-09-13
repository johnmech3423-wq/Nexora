"use client";

import * as React from "react";
import Link from "next/link";
import { useQueries, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import {
  AlertTriangle,
  AtSign,
  BellOff,
  CalendarClock,
  CheckCheck,
  CheckCircle2,
  Inbox,
  Info,
  Loader2,
  MessageCircle,
  PencilLine,
  Trash2,
  UserPlus,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { useActiveOrgId } from "@/lib/hooks/use-session";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { formatDateTime, cn } from "@/lib/utils";
import { toast } from "sonner";
import type { NotificationDTO } from "@/types";

const PAGE_SIZE = 20;

interface PagedNotifications {
  items: NotificationDTO[];
  total: number;
  unread: number;
  hasMore: boolean;
}

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  mention: AtSign,
  task_assigned: CheckCircle2,
  task_update: PencilLine,
  comment: MessageCircle,
  invitation: UserPlus,
  project_activity: Inbox,
  sprint_event: CalendarClock,
  chat_message: MessageCircle,
  deadline_reminder: AlertTriangle,
  system: Info,
};

function typeLabel(type: string): string {
  const map: Record<string, string> = {
    mention: "Mention",
    task_assigned: "Assignment",
    task_update: "Task update",
    comment: "Comment",
    invitation: "Invitation",
    project_activity: "Project",
    sprint_event: "Sprint",
    chat_message: "Chat",
    deadline_reminder: "Deadline",
    system: "System",
  };
  return map[type] ?? type.replace(/_/g, " ");
}

export default function NotificationsPage() {
  const orgId = useActiveOrgId();
  const qc = useQueryClient();
  const [unreadOnly, setUnreadOnly] = React.useState(false);
  const [loadedPages, setLoadedPages] = React.useState(1);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const queryKeys = Array.from({ length: loadedPages }).map((_, i) =>
    [...qk.notifications(orgId ?? "x"), unreadOnly ? "unread" : "all", "p", i + 1]
  );

  const pageQueries = useQueries({
    queries: queryKeys.map((key, i) => ({
      queryKey: key,
      queryFn: () =>
        apiFetch<PagedNotifications>(
          `/api/notifications?orgId=${orgId}${unreadOnly ? "&unreadOnly=true" : ""}&page=${i + 1}&pageSize=${PAGE_SIZE}`
        ),
      enabled: Boolean(orgId),
      refetchInterval: i === 0 ? 30_000 : undefined,
    })),
  }) as UseQueryResult<PagedNotifications>[];

  const first = pageQueries[0];
  const notifications = React.useMemo(() => {
    const seen = new Set<string>();
    const all: NotificationDTO[] = [];
    for (const q of pageQueries) {
      for (const n of q.data?.items ?? []) {
        if (!seen.has(n.id)) {
          seen.add(n.id);
          all.push(n);
        }
      }
    }
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [pageQueries]);

  const lastLoaded = pageQueries[loadedPages - 1];
  const hasMore = Boolean(lastLoaded?.data?.hasMore && !lastLoaded?.isFetching);
  const total = first?.data?.total ?? 0;
  const unreadTotal = first?.data?.unread ?? 0;
  const firstLoading = first?.isLoading ?? false;
  const firstError = first?.error ?? null;

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: qk.notifications(orgId ?? "x") });
    qc.invalidateQueries({ queryKey: qk.unreadCount(orgId ?? "x") });
  };

  const markOne = async (n: NotificationDTO) => {
    if (n.read) return;
    setBusyId(n.id);
    try {
      await apiFetch(`/api/notifications/${n.id}`, { method: "POST" });
      invalidateAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't mark as read.");
    } finally {
      setBusyId(null);
    }
  };

  const markAll = async () => {
    if (unreadTotal === 0) return;
    try {
      await apiFetch(`/api/notifications?orgId=${orgId}`, { method: "POST" });
      invalidateAll();
      toast.success("All notifications marked as read");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update notifications.");
    }
  };

  const remove = async (id: string) => {
    setBusyId(id);
    try {
      await apiFetch(`/api/notifications/${id}`, { method: "DELETE" });
      invalidateAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete notification.");
    } finally {
      setBusyId(null);
    }
  };

  const onOpen = (n: NotificationDTO) => {
    void markOne(n);
  };

  if (!orgId) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Notifications</h1>
          <p className="text-[13px] text-muted-foreground">
            {unreadOnly ? `${unreadTotal} unread` : `${total} total · ${unreadTotal} unread`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div role="group" aria-label="Filter notifications" className="flex rounded-lg bg-muted/70 p-0.5">
            <button
              type="button"
              aria-pressed={!unreadOnly}
              onClick={() => {
                setUnreadOnly(false);
                setLoadedPages(1);
              }}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                !unreadOnly ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              All
            </button>
            <button
              type="button"
              aria-pressed={unreadOnly}
              onClick={() => {
                setUnreadOnly(true);
                setLoadedPages(1);
              }}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                unreadOnly ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Unread
            </button>
          </div>
          <Button variant="outline" size="sm" disabled={unreadTotal === 0} onClick={markAll}>
            <CheckCheck /> Mark all read
          </Button>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {firstLoading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-[74px] animate-pulse rounded-xl border bg-card" />
            ))}
          </div>
        ) : firstError ? (
          <ErrorState
            title="Couldn't load notifications"
            message={firstError instanceof Error ? firstError.message : undefined}
            onRetry={() => first.refetch()}
          />
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={unreadOnly ? BellOff : Inbox}
            title={unreadOnly ? "No unread notifications" : "You're all caught up"}
            description={
              unreadOnly
                ? "Nothing waiting for you right now."
                : "Mentions, assignments, comments and chat messages will show up here."
            }
          />
        ) : (
          <>
            <ul role="list" aria-label={unreadOnly ? "Unread notifications" : "Notifications"} className="space-y-1.5">
              {notifications.map((n) => {
                const Icon = TYPE_ICONS[n.type] ?? Info;
                const pending = busyId === n.id;
                return (
                  <li
                    key={n.id}
                    className={cn(
                      "group relative flex items-start gap-3 rounded-xl border bg-card px-3 py-3 transition-colors sm:px-4",
                      n.read ? "" : "border-primary/25 bg-primary/[0.03]"
                    )}
                  >
                    {n.link ? (
                      <Link
                        href={n.link}
                        onClick={() => onOpen(n)}
                        className="absolute inset-0 z-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={`Open: ${n.title}`}
                      />
                    ) : null}
                    <span
                      aria-hidden
                      className={cn(
                        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                        n.read ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className={cn("text-[13.5px] leading-snug break-words", n.read ? "" : "font-medium")}>
                          <span className="mr-1.5">{n.title}</span>
                          {n.actor ? (
                            <span className="inline-flex items-center gap-1 align-middle">
                              <Avatar name={n.actor.name} src={n.actor.avatarUrl} size="xs" className="align-middle" />
                            </span>
                          ) : null}
                        </p>
                        <span className="shrink-0 text-[11px] whitespace-nowrap text-muted-foreground">
                          {formatDateTime(n.createdAt)}
                        </span>
                      </div>
                      {n.body ? <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p> : null}
                      <div className="mt-1.5 flex items-center gap-2">
                        <Badge variant="muted" className="normal-case">
                          {typeLabel(n.type)}
                        </Badge>
                      </div>
                    </div>
                    <div
                      className={cn(
                        "relative z-10 flex shrink-0 items-center gap-0.5 self-start",
                        "opacity-100 lg:opacity-0 lg:transition-opacity lg:group-hover:opacity-100 lg:group-focus-within:opacity-100"
                      )}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {!n.read ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Mark as read"
                          disabled={pending}
                          onClick={() => markOne(n)}
                        >
                          {pending ? <Loader2 className="size-4 animate-spin" /> : <CheckCheck className="size-4" />}
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Delete notification"
                        disabled={pending}
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => remove(n.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    {!n.read ? <span aria-hidden className="absolute top-3.5 right-3.5 size-2 rounded-full bg-primary lg:right-4" /> : null}
                  </li>
                );
              })}
            </ul>

            {hasMore ? (
              <div className="flex justify-center pt-1">
                <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setLoadedPages((p) => p + 1)}>
                  <Loader2 className={cn("size-3.5", pageQueries[loadedPages]?.isFetching ? "animate-spin" : "opacity-0")} />
                  Load older notifications
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
