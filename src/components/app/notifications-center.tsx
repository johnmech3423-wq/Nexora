"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { qk } from "@/lib/query-keys";
import { useActiveOrgId } from "@/lib/hooks/use-session";
import { Avatar } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EmptyState } from "@/components/ui/state";
import { cn, timeAgo } from "@/lib/utils";
import { toast } from "sonner";
import { Inbox } from "lucide-react";
import type { NotificationDTO } from "@/types";

export function NotificationBell() {
  const orgId = useActiveOrgId();
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);

  const list = useQuery({
    queryKey: qk.notifications(orgId ?? "x"),
    queryFn: () =>
      apiFetch<{ items: NotificationDTO[]; total: number; unread: number }>(
        `/api/notifications${orgId ? `?orgId=${orgId}` : ""}`
      ),
    enabled: Boolean(orgId),
    refetchInterval: 45_000,
  });

  const markAll = useMutation({
    mutationFn: () =>
      apiFetch(`/api/notifications${orgId ? `?orgId=${orgId}` : ""}`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.notifications(orgId ?? "x") });
      qc.invalidateQueries({ queryKey: qk.unreadCount(orgId ?? "x") });
    },
  });

  const markOne = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/notifications/${id}`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/notifications/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not delete notification"),
  });

  const items = list.data?.items ?? [];
  const unread = items.filter((n) => !n.read).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "relative text-foreground/80"
        )}
      >
        <Bell className="size-[18px]" />
        {unread > 0 ? (
          <span className="absolute top-1.5 right-1.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground ring-2 ring-background">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <p className="text-sm font-semibold">Notifications</p>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" aria-label="Mark all as read" disabled={!unread || markAll.isPending} onClick={() => markAll.mutate()}>
              <CheckCheck className="size-4" />
            </Button>
          </div>
        </div>
        <div className="max-h-[380px] overflow-y-auto">
          {list.isLoading ? (
            <div className="space-y-2 p-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-md bg-secondary/60" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState icon={Inbox} title="You're all caught up" description="Notifications about mentions, assignments and chat will appear here." compact />
          ) : (
            <ul role="list" className="divide-y">
              {items.map((n) => (
                <li key={n.id} className={`group relative px-4 py-2.5 ${n.read ? "" : "bg-primary/[0.04]"}`}>
                  <div className="flex items-start gap-2.5">
                    <Avatar name={n.actor?.name ?? null} src={n.actor?.avatarUrl} size="sm" className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] leading-snug">
                        <span className="font-medium">{n.title}</span>
                      </p>
                      {n.body ? <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p> : null}
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <Badge variant="muted" className="normal-case">
                          {typeLabel(n.type)}
                        </Badge>
                        <span>{timeAgo(n.createdAt)}</span>
                      </div>
                    </div>
                    <span className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      {n.link ? (
                        <Button variant="ghost" size="icon-sm" aria-label="Open" asChild>
                          <Link href={n.link} onClick={() => { if (!n.read) markOne.mutate(n.id); setOpen(false); }}>
                            →
                          </Link>
                        </Button>
                      ) : null}
                      {!n.read ? (
                        <Button variant="ghost" size="icon-sm" aria-label="Mark read" onClick={() => markOne.mutate(n.id)}>
                          <CheckCheck className="size-3.5" />
                        </Button>
                      ) : null}
                      <Button variant="ghost" size="icon-sm" aria-label="Delete" onClick={() => remove.mutate(n.id)}>
                        <Trash2 className="size-3.5 text-muted-foreground" />
                      </Button>
                    </span>
                  </div>
                  {!n.read ? <span aria-hidden className="absolute top-3 right-3 size-1.5 rounded-full bg-primary" /> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex items-center justify-center border-t px-2 py-1.5">
          <Button variant="ghost" size="sm" className="w-full justify-start text-[13px] text-muted-foreground" asChild>
            <Link href="/notifications" onClick={() => setOpen(false)}>
              <Bell className="size-3.5" /> View all notifications
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function useUnreadCount() {
  const orgId = useActiveOrgId();
  return useQuery({
    queryKey: qk.unreadCount(orgId ?? "x"),
    queryFn: () =>
      apiFetch<{ count: number }>(`/api/notifications/count?orgId=${orgId}`).then((d) => d.count),
    enabled: Boolean(orgId),
    refetchInterval: 60_000,
  });
}

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
