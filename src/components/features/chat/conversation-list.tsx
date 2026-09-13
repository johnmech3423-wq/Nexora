"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCheck, MessageSquareOff, PenLine, Search } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { useActiveOrgId, useMe } from "@/lib/hooks/use-session";
import { apiErrorMessage } from "@/components/features/error-handling";
import { ConversationLink, conversationDisplayName, stripMentions, usePresenceMap } from "@/components/features/chat/chat-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ConversationDTO } from "@/types";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "dm", label: "Direct" },
  { id: "group", label: "Groups" },
  { id: "channel", label: "Channels" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

export function ConversationList({
  activeConversationId,
  onNew,
}: {
  activeConversationId?: string;
  onNew: () => void;
}) {
  const orgId = useActiveOrgId();
  const me = useMe();
  const [q, setQ] = React.useState("");
  const [filter, setFilter] = React.useState<FilterId>("all");
  const { online } = usePresenceMap(orgId);

  const list = useQuery({
    queryKey: qk.conversations(orgId ?? "x"),
    queryFn: () => apiFetch<{ items: ConversationDTO[] }>(`/api/chat/conversations?orgId=${orgId}`).then((d) => d.items),
    enabled: Boolean(orgId),
  });

  const unreadTotal = React.useMemo(
    () => (list.data ?? []).reduce((acc, c) => acc + c.unreadCount, 0),
    [list.data]
  );

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (list.data ?? []).filter((c) => {
      if (filter === "unread" && c.unreadCount === 0) return false;
      if (filter === "dm" && c.type !== "dm") return false;
      if (filter === "group" && c.type !== "group") return false;
      if (filter === "channel" && c.type !== "project_channel") return false;
      if (!needle) return true;
      return conversationDisplayName(c).toLowerCase().includes(needle) || c.members.some((m) => m.name.toLowerCase().includes(needle));
    });
  }, [list.data, q, filter]);

  const meId = me.data?.user?.id;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2 p-3 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search conversations…"
            aria-label="Search conversations"
            className="h-8.5 pl-8 text-[13px]"
          />
        </div>
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1 overflow-x-auto">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                aria-pressed={filter === f.id}
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors",
                  filter === f.id ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-label="New conversation"
            onClick={onNew}
            className="flex size-6 shrink-0 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            <PenLine className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-3" role="list" aria-label="Conversations">
        {list.isLoading ? (
          <div className="space-y-2 p-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-2.5 px-2 py-2">
                <div className="size-8 shrink-0 animate-pulse rounded-full bg-secondary" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-3/4 animate-pulse rounded bg-secondary" />
                  <div className="h-2.5 w-1/2 animate-pulse rounded bg-secondary/70" />
                </div>
              </div>
            ))}
          </div>
        ) : list.isError ? (
          <div className="p-4 text-center">
            <p className="text-[13px] text-destructive">{apiErrorMessage(list.error, "Couldn't load conversations.")}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => list.refetch()}>
              Try again
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <MessageSquareOff className="size-8 text-muted-foreground/40" aria-hidden />
            <p className="text-[13px] font-medium">
              {q || filter !== "all" ? "No conversations match." : "No conversations yet"}
            </p>
            <p className="text-xs text-muted-foreground">
              {q || filter !== "all"
                ? "Try a different search or filter."
                : "Start a direct message or a group with your teammates."}
            </p>
            {!q && filter === "all" ? (
              <Button size="sm" variant="outline" className="mt-1" onClick={onNew}>
                <PenLine /> New conversation
              </Button>
            ) : null}
          </div>
        ) : (
          filtered.map((c) => {
            const active = c.id === activeConversationId;
            const dmOnline =
              c.type === "dm" ? c.members.some((m) => m.userId !== meId && online.has(m.userId)) : false;
            return (
              <div key={c.id} className={cn("relative rounded-lg", c.unreadCount > 0 && !active && "bg-primary/[0.07]")} role="listitem">
                <ConversationLink
                  conversation={c}
                  active={active}
                  presenceOnline={dmOnline}
                  subtitle={
                    c.lastMessage ? (
                      <span className="flex items-center gap-1">
                        {c.lastMessage.senderName && c.type !== "dm" ? (
                          <span className="truncate">{c.lastMessage.senderName}: </span>
                        ) : null}
                        <span className="truncate font-normal">{stripMentions(c.lastMessage.body)}</span>
                      </span>
                    ) : (
                      "No messages yet"
                    )
                  }
                />
                <div className="pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2">
                  {c.unreadCount > 0 ? (
                    <span className="flex min-w-4.5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                      {c.unreadCount > 99 ? "99+" : c.unreadCount}
                    </span>
                  ) : c.lastMessage?.senderName === meId ? (
                    <CheckCheck className="size-3.5 text-muted-foreground/60" aria-label="Sent" />
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t px-3 py-1.5 text-[11px] text-muted-foreground">
        {unreadTotal > 0 ? (
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden /> {unreadTotal} unread
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <CheckCheck className="size-3" aria-hidden /> You&apos;re all caught up
          </span>
        )}
      </div>
    </div>
  );
}


