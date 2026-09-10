"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Check, Hash, Loader2, MessageCirclePlus, Search, Users } from "lucide-react";
import { apiFetch, qs } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { useActiveOrgId, useMe } from "@/lib/hooks/use-session";
import { apiErrorMessage } from "@/components/features/error-handling";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCreateConversation } from "@/lib/hooks/chat";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { OrgMemberDTO, ProjectSummaryDTO } from "@/types";

type Mode = "dm" | "group" | "channel";

export function NewConversationDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (conversationId: string) => void;
}) {
  const orgId = useActiveOrgId();
  const me = useMe();
  const router = useRouter();
  const [mode, setMode] = React.useState<Mode>("dm");
  const [q, setQ] = React.useState("");
  const [groupName, setGroupName] = React.useState("");
  const [selected, setSelected] = React.useState<string[]>([]);
  const [projectId, setProjectId] = React.useState<string>("");
  const create = useCreateConversation(orgId ?? "");
  const meId = me.data?.user?.id;

  const members = useQuery({
    queryKey: ["org-members", orgId],
    queryFn: () => apiFetch<{ members: OrgMemberDTO[] }>(`/api/organizations/${orgId}/members`),
    enabled: Boolean(orgId),
  });
  const projects = useQuery({
    queryKey: qk.projects(orgId ?? "x", "chat"),
    queryFn: () => apiFetch<{ items: ProjectSummaryDTO[] }>(`/api/projects${qs({ orgId, pageSize: 100, status: "active" })}`),
    enabled: Boolean(orgId) && mode === "channel",
  });

  const others = (members.data?.members ?? []).filter((m) => m.userId !== meId && m.status === "active");
  const filtered = others.filter((m) => {
    const needle = q.trim().toLowerCase();
    return !needle || m.name.toLowerCase().includes(needle) || m.email.toLowerCase().includes(needle);
  });

  const close = () => {
    onOpenChange(false);
    setQ("");
    setGroupName("");
    setSelected([]);
    setProjectId("");
  };

  const startDm = (peerId: string) => {
    create.mutate(
      { type: "dm", peerId },
      {
        onSuccess: (data) => {
          const id = data.conversation.id;
          close();
          onCreated?.(id);
          router.push(`/chat/${id}`);
        },
        onError: (e) => toast.error(apiErrorMessage(e)),
      }
    );
  };

  const createGroup = () => {
    if (!groupName.trim() || selected.length === 0) return;
    create.mutate(
      { type: "group", name: groupName.trim(), memberIds: selected },
      {
        onSuccess: (data) => {
          toast.success("Group created");
          close();
          const id = data.conversation.id;
          onCreated?.(id);
          router.push(`/chat/${id}`);
        },
        onError: (e) => toast.error(apiErrorMessage(e)),
      }
    );
  };

  const openChannel = () => {
    if (!projectId) return;
    create.mutate(
      { type: "project_channel", projectId },
      {
        onSuccess: (data) => {
          const id = data.conversation.id;
          close();
          onCreated?.(id);
          router.push(`/chat/${id}`);
        },
        onError: (e) => toast.error(apiErrorMessage(e)),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setMode("dm") : close())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCirclePlus className="size-5 text-primary" /> New conversation
          </DialogTitle>
          <DialogDescription>Direct message, group chat, or a channel for a project.</DialogDescription>
        </DialogHeader>

        <div role="tablist" aria-label="Conversation type" className="grid grid-cols-3 rounded-lg bg-muted/60 p-0.5">
          {(
            [
              ["dm", "Direct", MessageCirclePlus],
              ["group", "Group", Users],
              ["channel", "Channel", Hash],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              role="tab"
              aria-selected={mode === key}
              onClick={() => setMode(key)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                mode === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-3.5" /> {label}
            </button>
          ))}
        </div>

        {mode === "dm" ? (
          <div className="space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search members…" className="pl-8" autoFocus />
            </div>
            <div className="max-h-72 space-y-0.5 overflow-y-auto pr-1">
              {filtered.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {others.length === 0 ? "No other members in this workspace yet." : "No matches."}
                </p>
              ) : (
                filtered.map((m) => (
                  <button
                    key={m.userId}
                    type="button"
                    onClick={() => startDm(m.userId)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-accent"
                  >
                    <Avatar name={m.name} src={m.avatarUrl} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{m.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{m.email}</span>
                    </span>
                    <span className="text-xs capitalize text-muted-foreground">{m.role}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : null}

        {mode === "group" ? (
          <div className="space-y-3">
            <Input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name"
              aria-label="Group name"
              autoFocus
            />
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add members…" className="pl-8" />
            </div>
            <div className="max-h-56 space-y-0.5 overflow-y-auto pr-1" role="listbox" aria-label="Group members" aria-multiselectable="true">
              {filtered.map((m) => {
                const on = selected.includes(m.userId);
                return (
                  <button
                    key={m.userId}
                    type="button"
                    role="option"
                    aria-selected={on}
                    onClick={() => setSelected((s) => (on ? s.filter((id) => id !== m.userId) : [...s, m.userId]))}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-accent"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "flex size-4 items-center justify-center rounded border",
                        on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
                      )}
                    >
                      {on ? <Check className="size-3" /> : null}
                    </span>
                    <Avatar name={m.name} src={m.avatarUrl} size="xs" />
                    <span className="min-w-0 flex-1 truncate text-[13px]">{m.name}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {selected.length} member{selected.length === 1 ? "" : "s"} selected
            </p>
            <Button className="w-full" onClick={createGroup} disabled={!groupName.trim() || selected.length === 0} loading={create.isPending}>
              <Users /> Create group
            </Button>
          </div>
        ) : null}

        {mode === "channel" ? (
          <div className="space-y-3">
            <p className="text-[13px] text-muted-foreground">
              Every project can have one channel — conversation starts around its tasks and files.
            </p>
            {projects.isLoading ? (
              <div className="space-y-1.5">
                {[0, 1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-secondary/60" />)}
              </div>
            ) : (projects.data?.items ?? []).length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No active projects to channel.</p>
            ) : (
              <div className="max-h-64 space-y-0.5 overflow-y-auto pr-1" role="listbox" aria-label="Projects">
                {(projects.data?.items ?? []).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="option"
                    aria-selected={projectId === p.id}
                    onClick={() => setProjectId(p.id)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-accent"
                  >
                    <span aria-hidden className="size-2.5 rounded-sm" style={{ background: p.color ?? "#64748b" }} />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{p.name}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{p.key}</span>
                  </button>
                ))}
              </div>
            )}
            <Button className="w-full" onClick={openChannel} disabled={!projectId} loading={create.isPending}>
              <Hash /> Open channel
            </Button>
          </div>
        ) : null}

        {create.isPending ? (
          <p className="sr-only" role="status"><Loader2 className="animate-spin" /> Creating…</p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
