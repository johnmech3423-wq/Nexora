"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Hash, MessageCircle, Users } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { Avatar } from "@/components/ui/avatar";
import type { ConversationDTO } from "@/types";

/** Icons for each conversation type. */
export function ConversationGlyph({
  conversation,
}: {
  conversation: Pick<ConversationDTO, "type" | "iconUrl">;
}) {
  if (conversation.iconUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={conversation.iconUrl} alt="" className="size-5 rounded-full object-cover" loading="lazy" />;
  }
  if (conversation.type === "project_channel") return <Hash className="size-4 text-muted-foreground" aria-hidden />;
  if (conversation.type === "group") return <Users className="size-4 text-muted-foreground" aria-hidden />;
  return <MessageCircle className="size-4 text-muted-foreground" aria-hidden />;
}

/** Compact avatar stack used in conversation list rows. */
export function ConversationAvatars({ conversation, size = "sm" }: { conversation: ConversationDTO; size?: "xs" | "sm" }) {
  const shown = conversation.members.slice(0, 3);
  if (conversation.type === "project_channel") {
    return <HashGlyph />;
  }
  return (
    <div className="flex -space-x-1.5">
      {shown.map((m) => (
        <Avatar key={m.userId} name={m.name} src={m.avatarUrl} size={size} className="ring-2 ring-card" />
      ))}
      {conversation.members.length > 3 ? (
        <span className="flex size-5 items-center justify-center rounded-full bg-secondary text-[9px] font-semibold ring-2 ring-card">
          +{conversation.members.length - 3}
        </span>
      ) : null}
    </div>
  );
}

function HashGlyph() {
  return (
    <span aria-hidden className="flex size-5 items-center justify-center rounded-md bg-secondary text-muted-foreground">
      <Hash className="size-3" />
    </span>
  );
}

/** Channel-style display name with # for project channels. */
export function conversationDisplayName(conversation: ConversationDTO): string {
  if (conversation.type === "project_channel") return `# ${conversation.name.replace(/^#\s*/, "")}`;
  return conversation.name;
}

/** Strip @[Name](id) mention markup for plain-text previews. */
export function stripMentions(body: string): string {
  return body.replace(/@\[([^\]]+)\]\([a-f0-9]{24}\)/g, "@$1");
}

/** Rendered conversation row used by the sidebar & search results. */
export function ConversationLink({
  conversation,
  active,
  presenceOnline,
  subtitle,
}: {
  conversation: ConversationDTO;
  active?: boolean;
  presenceOnline?: boolean;
  subtitle?: React.ReactNode;
}) {
  return (
    <Link
      href={`/chat/${conversation.id}`}
      aria-current={active ? "page" : undefined}
      className={
        "group relative flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring " +
        (active ? "bg-accent text-accent-foreground" : "hover:bg-accent/60")
      }
    >
      <span className="relative shrink-0">
        <ConversationAvatars conversation={conversation} />
        {conversation.type === "dm" && presenceOnline ? (
          <span aria-label="Online" className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium">
          {conversationDisplayName(conversation)}
        </span>
        {subtitle ? <span className="block truncate text-xs text-muted-foreground">{subtitle}</span> : null}
      </span>
    </Link>
  );
}

/** Live presence of org members (polled; realtime layer augments it). */
export function usePresence(orgId: string | null) {
  return useQuery({
    queryKey: qk.presence(orgId ?? "x"),
    queryFn: () =>
      apiFetch<{ items: { userId: string; name: string; avatarUrl: string | null }[] }>(
        `/api/chat/presence?orgId=${orgId}`
      ).then((d) => d.items),
    enabled: Boolean(orgId),
    refetchInterval: 60_000,
  });
}

export function usePresenceMap(orgId: string | null) {
  const presence = usePresence(orgId);
  const map = React.useMemo(() => {
    const m = new Map<string, true>();
    for (const u of presence.data ?? []) m.set(u.userId, true);
    return m;
  }, [presence.data]);
  return { online: map, isLoading: presence.isLoading };
}
