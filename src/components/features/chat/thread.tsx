"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQueries, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  CornerDownRight,
  FileText,
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Send,
  Smile,
  Trash2,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { useMe } from "@/lib/hooks/use-session";
import { apiErrorMessage } from "@/components/features/error-handling";
import { usePresenceMap } from "@/components/features/chat/chat-utils";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog, ConfirmDialogContent } from "@/components/ui/confirm-dialog";
import { formatDateTime, cn } from "@/lib/utils";
import { toast } from "sonner";
import type { ConversationDTO, FileMetaDTO, MessageDTO, OrgMemberDTO, ReactionDTO } from "@/types";
import { useSendMessage, useEditMessage, useDeleteMessage, useToggleReaction } from "@/lib/hooks/chat";

const QUICK_EMOJI = ["👍", "❤️", "🎉", "🔥", "👀", "😂", "🚀", "✅"];
const PAGE_SIZE = 50;

interface TypingUser {
  userId: string;
  name: string;
  until: number;
}

interface TempMessage {
  id: string;
  body: string;
  parentId?: string | null;
  createdAt: number;
  status: "sending" | "error";
  error?: string;
}

interface PagedMessages {
  conversation: ConversationDTO;
  items: MessageDTO[];
  total: number;
  hasMore: boolean;
}

export function ChatThread({ conversationId, orgId }: { conversationId: string; orgId: string }) {

  const me = useMe();
  const qc = useQueryClient();
  const router = useRouter();
  const [loadedPages, setLoadedPages] = React.useState(1);
  const { online } = usePresenceMap(orgId);
  const meId = me.data?.user?.id;

  // members of the org (for mention autocomplete + avatar fallbacks)
  const membersQ = useQuery({
    queryKey: ["org-members", orgId],
    queryFn: () => apiFetch<{ members: OrgMemberDTO[] }>(`/api/organizations/${orgId}/members`),
  });
  const members = membersQ.data?.members ?? [];

  // ---- paginated history: pages 1..loadedPages (1 = newest) ----
  const pageQueries = useQueries({
    queries: Array.from({ length: loadedPages }).map((_, i) => ({
      queryKey: [...qk.messages(orgId, conversationId), "p", i + 1],
      queryFn: () =>
        apiFetch<PagedMessages>(
          `/api/chat/conversations/${conversationId}?page=${i + 1}&pageSize=${PAGE_SIZE}`
        ),
      enabled: true,
      refetchInterval: i === 0 ? 20_000 : undefined, // keep newest page fresh (no-realtime fallback)
    })),
  }) as UseQueryResult<PagedMessages>[];

  const conv = pageQueries[0]?.data?.conversation;
  const canLoadOlder = Boolean(pageQueries[0]?.data?.hasMore);
  const loadingFirst = pageQueries[0]?.isLoading;
  const loadError = pageQueries[0]?.error ?? undefined;

  const allPages = pageQueries.map((q) => q.data).filter((d): d is PagedMessages => Boolean(d));
  const serverMessages = React.useMemo(
    () => allPages.flatMap((d) => d.items).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [allPages]
  );

  // ---- optimistic outbox ----
  const [outbox, setOutbox] = React.useState<TempMessage[]>([]);
  const [typers, setTypers] = React.useState<TypingUser[]>([]);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const atBottomRef = React.useRef(true);
  const lastReadAt = React.useRef<string | null>(null);
  const typingSentAt = React.useRef(0);

  // realtime hooks: message events invalidate via RealtimeProvider; typing via window events
  React.useEffect(() => {
    const onTyping = (e: Event) => {
      const data = (e as CustomEvent).detail?.data as { conversationId?: string; user?: { userId: string; name: string } } | undefined;
      if (!data?.conversationId || !data.user || data.conversationId !== conversationId) return;
      if (data.user.userId === meId) return;
      setTypers((prev) => {
        const next = prev.filter((t) => t.userId !== data.user!.userId);
        next.push({ userId: data.user!.userId, name: data.user!.name, until: Date.now() + 4000 });
        return next;
      });
    };
    window.addEventListener("nexora:typing", onTyping);
    const timer = setInterval(() => setTypers((prev) => prev.filter((t) => t.until > Date.now())), 2000);
    return () => {
      window.removeEventListener("nexora:typing", onTyping);
      clearInterval(timer);
    };
  }, [conversationId, meId]);

  // keep at bottom unless user scrolled up; auto-scroll when new messages arrive
  const scrollToBottom = (smooth = false) => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  };

  React.useEffect(() => {
    if (loadingFirst) return;
    const el = scrollRef.current;
    if (!el) return;
    if (atBottomRef.current) scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverMessages.length]);

  // Mark read (throttled per newest message)
  const markRead = React.useCallback(
    (newestCreatedAt?: string) => {
      if (!newestCreatedAt) return;
      if (lastReadAt.current === newestCreatedAt) return;
      lastReadAt.current = newestCreatedAt;
      void apiFetch(`/api/chat/conversations/${conversationId}/read`, { method: "POST" }).catch(() => undefined);
      qc.invalidateQueries({ queryKey: qk.conversations(orgId) });
    },
    [conversationId, orgId, qc]
  );

  const lastServerMsg = serverMessages[serverMessages.length - 1];
  const lastServerCreatedAt = lastServerMsg?.createdAt;
  React.useEffect(() => {
    if (lastServerCreatedAt) markRead(lastServerCreatedAt);
  }, [lastServerCreatedAt, markRead]);

  // ---- mutations ----
  const send = useSendMessage(orgId, conversationId);
  const editMsg = useEditMessage(orgId, conversationId);
  const deleteMsg = useDeleteMessage(orgId, conversationId);
  const react = useToggleReaction(orgId, conversationId);

  const [replyTo, setReplyTo] = React.useState<MessageDTO | null>(null);
  const [editTarget, setEditTarget] = React.useState<MessageDTO | null>(null);
  const [editDraft, setEditDraft] = React.useState("");
  const [confirmDelete, setConfirmDelete] = React.useState<MessageDTO | null>(null);
  const [pendingUploads, setPendingUploads] = React.useState<{ key: string; name: string; progress: number }[]>([]);
  const uidRef = React.useRef(0);

  const isDm = conv?.type === "dm";
  const convMembers = conv?.members ?? [];
  const othersInDm = convMembers.filter((m) => m.userId !== meId);

  const peerName = isDm ? othersInDm[0]?.name ?? conv?.name ?? "Conversation" : undefined;
  const typingNames = typers.map((t) => t.name);

  const removeTemp = (id: string) => setOutbox((o) => o.filter((m) => m.id !== id));

  const transmit = (payload: { body: string; parentId?: string | null; attachmentFileIds?: string[] }) => {
    uidRef.current += 1;
    const tempId = `tmp-${uidRef.current}`;
    setOutbox((o) => [
      ...o,
      {
        id: tempId,
        body: payload.body,
        parentId: payload.parentId,
        createdAt: Date.now(),
        status: "sending",
      },
    ]);
    send.mutate(
      { body: payload.body, parentId: payload.parentId ?? undefined, attachmentFileIds: payload.attachmentFileIds },
      {
        onSuccess: () => {
          removeTemp(tempId);
          scrollToBottom();
        },
        onError: (e) => {
          setOutbox((o) =>
            o.map((m) =>
              m.id === tempId
                ? { ...m, status: "error" as const, error: apiErrorMessage(e, "Couldn't send the message.") }
                : m
            )
          );
        },
      }
    );
  };

  // Upload attachments (kind message_attachment scoped to the conversation)
  const uploadFiles = (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    void (async () => {
      for (const file of list) {
        const key = `${Date.now()}-${file.name}`;
        setPendingUploads((u) => [...u, { key, name: file.name, progress: 0 }]);
        const fd = new FormData();
        fd.append("kind", "message_attachment");
        fd.append("file", file);
        fd.append("orgId", orgId);
        fd.append("conversationId", conversationId);
        try {
          const res = await xhrUpload("/api/files", fd, (pct) =>
            setPendingUploads((u) => u.map((x) => (x.key === key ? { ...x, progress: pct } : x)))
          );
          const data = res as { success: boolean; data?: { file?: FileMetaDTO }; error?: { message?: string } };
          if (!data.success) throw new Error(data.error?.message ?? "Upload failed");
          const meta = data.data?.file;
          if (meta) setAttachMeta((a) => [...a, meta]);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : `Couldn't upload ${file.name}.`);
        } finally {
          setPendingUploads((u) => u.filter((x) => x.key !== key));
        }
      }
    })();
  };
  const [attachMeta, setAttachMeta] = React.useState<FileMetaDTO[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // typing broadcast (throttled ~2s)
  const notifyTyping = () => {
    const now = Date.now();
    if (now - typingSentAt.current < 2000) return;
    typingSentAt.current = now;
    void apiFetch(`/api/chat/conversations/${conversationId}/typing`, { method: "POST" }).catch(() => undefined);
  };

  if (!orgId || !meId) return null;

  const merged: (MessageDTO | TempMessage)[] = [...outbox, ...serverMessages].sort((a, b) => {
    const timeA = typeof a.createdAt === "number" ? a.createdAt : Date.parse(a.createdAt);
    const timeB = typeof b.createdAt === "number" ? b.createdAt : Date.parse(b.createdAt);
    return timeA - timeB;
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b bg-card px-3 py-2.5 lg:px-4">
        <Button variant="ghost" size="icon-sm" aria-label="Back to conversations" className="md:hidden" onClick={() => router.push("/chat")}>
          <ArrowLeft />
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 truncate text-sm font-semibold">
            {conv ? (
              <>
                {conv.type === "project_channel" ? <span className="text-muted-foreground">#</span> : null}
                <span className="truncate">{conv.name}</span>
              </>
            ) : peerName ? (
              peerName
            ) : (
              "…"
            )}
          </h2>
          {typingNames.length ? (
            <p className="truncate text-xs text-primary" aria-live="polite">
              {typingNames.join(", ")} typing…
            </p>
          ) : conv && conv.type === "dm" && othersInDm.length ? (
            <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              <span
                aria-hidden
                className={cn("size-2 rounded-full", online.has(othersInDm[0].userId) ? "bg-emerald-500" : "bg-muted-foreground/40")}
              />
              {online.has(othersInDm[0].userId) ? "Online" : "Offline"}
            </p>
          ) : conv && conv.type === "group" ? (
            <p className="truncate text-xs text-muted-foreground">
              {conv.members.length} members · {conv.members.filter((m) => online.has(m.userId)).length} online
            </p>
          ) : null}
        </div>
        <ChatSearchButton orgId={orgId} />
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
        }}
        className="min-h-0 flex-1 space-y-0 overflow-y-auto px-3 py-3 lg:px-4"
        role="log"
        aria-label="Messages"
      >
        {/* Load older */}
        <div className="flex justify-center pb-1">
          {canLoadOlder ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => {
                // remember position so we can restore scroll after older messages load
                const el = scrollRef.current;
                const prevHeight = el?.scrollHeight ?? 0;
                setLoadedPages((p) => p + 1);
                requestAnimationFrame(() => {
                  if (el) el.scrollTop = el.scrollHeight - prevHeight;
                });
              }}
              loading={pageQueries[loadedPages]?.isFetching}
            >
              Load older messages
            </Button>
          ) : pageQueries[0]?.data && pageQueries[0].data.total > PAGE_SIZE ? (
            <p className="py-1 text-[11px] text-muted-foreground">Beginning of conversation</p>
          ) : null}
        </div>

        {loadError && !serverMessages.length ? (
          <ThreadError error={loadError} onRetry={() => pageQueries[0]?.refetch()} />
        ) : loadingFirst && !serverMessages.length ? (
          <div className="space-y-3 py-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="size-8 animate-pulse rounded-full bg-secondary" />
                <div className="space-y-1.5">
                  <div className="h-3 w-24 animate-pulse rounded bg-secondary" />
                  <div className="h-8 w-64 max-w-[60vw] animate-pulse rounded bg-secondary/70" />
                </div>
              </div>
            ))}
          </div>
        ) : merged.length === 0 ? (
          <div className="flex h-full min-h-40 flex-col items-center justify-center gap-1 text-center">
            <p className="text-sm font-medium">No messages yet</p>
            <p className="max-w-xs text-[13px] text-muted-foreground">Say hello 👋 — this conversation has no messages.</p>
          </div>
        ) : (
          merged.map((m, i) => {
            const prev = merged[i - 1];
            const sameDay = prev && dayKey(prev) === dayKey(m);
            const sameAuthor =
              prev && "sender" in m && "sender" in prev && m.sender.userId === prev.sender.userId;
            const gap = !sameDay || !sameAuthor;
            return (
              <React.Fragment key={m.id}>
                {!sameDay ? <DayDivider createdAt={m.createdAt} /> : null}
                {"sender" in m && m.parent ? (
                  <ReplyQuote message={m as MessageDTO} />
                ) : "parentId" in m && m.parentId ? (
                  <div className="pt-1" />
                ) : null}
                {"sender" in m ? (
                  <ServerMessageRow
                    message={m as MessageDTO}
                    gap={gap}
                    members={members}
                    onReply={(msg) => { setReplyTo(msg); }}
                    onEdit={(msg) => { setEditDraft(msg.body); setEditTarget(msg); }}
                    onDelete={(msg) => setConfirmDelete(msg)}
                    onReact={(msg, emoji) => react.mutate({ messageId: msg.id, emoji })}
                    editing={editTarget?.id === m.id}
                    editDraft={editDraft}
                    onEditDraftChange={setEditDraft}
                    editBusy={editMsg.isPending}
                    onEditSave={(body) => editMsg.mutate({ messageId: m.id, body }, { onError: (e) => toast.error(apiErrorMessage(e)) })}
                    onCancelEdit={() => { setEditTarget(null); setEditDraft(""); }}
                  />
                ) : (
                  <OutboxRow temp={m as TempMessage} onRetry={(tm) => { removeTemp(tm.id); transmit({ body: tm.body, parentId: tm.parentId, attachmentFileIds: undefined }); }} onDismiss={() => removeTemp(m.id)} />
                )}
              </React.Fragment>
            );
          })
        )}

        {/* scroll-to-bottom affordance handled via position indicator */}
      </div>

      {/* Composer */}
      <div className="border-t bg-card p-2 lg:p-3">
        {replyTo ? (
          <div className="mb-1.5 flex items-center gap-2 rounded-md bg-muted/70 px-2 py-1 text-xs text-muted-foreground">
            <CornerDownRight className="size-3.5 shrink-0" />
            <span className="min-w-0 flex-1 truncate">
              Replying to <span className="font-medium text-foreground">{replyTo.sender.name}</span>: {snippet(replyTo.body)}
            </span>
            <Button variant="ghost" size="icon-sm" aria-label="Cancel reply" onClick={() => setReplyTo(null)}>
              <X />
            </Button>
          </div>
        ) : null}
        {pendingUploads.length > 0 ? (
          <div className="mb-1.5 space-y-1">
            {pendingUploads.map((u) => (
              <div key={u.key} className="flex items-center gap-2 rounded-md border bg-muted/40 px-2 py-1 text-xs">
                <Paperclip className="size-3 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{u.name}</span>
                <span className="tabular-nums text-muted-foreground">{u.progress}%</span>
                <span className="h-1 w-20 overflow-hidden rounded-full bg-secondary">
                  <span className="block h-full bg-primary transition-all" style={{ width: `${u.progress}%` }} />
                </span>
              </div>
            ))}
          </div>
        ) : null}
        {attachMeta.length > 0 ? (
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            {attachMeta.map((f) => (
              <span key={f.id} className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-1 text-xs">
                <FileGlyph name={f.name} />
                <span className="max-w-40 truncate">{f.name}</span>
                <Button variant="ghost" size="icon-sm" className="size-4" aria-label={`Remove ${f.name}`} onClick={() => setAttachMeta((a) => a.filter((x) => x.id !== f.id))}>
                  <X className="size-2.5" />
                </Button>
              </span>
            ))}
          </div>
        ) : null}
        <Composer
          members={members}
          meId={meId}
          notifyTyping={notifyTyping}
          onSend={(body) => {
            const fileIds = attachMeta.map((f) => f.id);
            const parentId = replyTo?.id;
            transmit({ body, parentId, attachmentFileIds: fileIds.length ? fileIds : undefined });
            setReplyTo(null);
            setAttachMeta([]);
          }}
          onAttach={() => fileInputRef.current?.click()}
        />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          aria-hidden
          onChange={(e) => {
            if (e.target.files?.length) uploadFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <p className="sr-only" aria-live="polite">
          {send.isPending ? "Sending…" : ""}
        </p>
      </div>

      {/* delete confirm */}
      <ConfirmDialog open={Boolean(confirmDelete)} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <ConfirmDialogContent
          title="Delete message?"
          description="The message is removed for everyone in this conversation."
          confirmLabel="Delete"
          destructive
          loading={deleteMsg.isPending}
          onConfirm={() => {
            if (confirmDelete) deleteMsg.mutate(confirmDelete.id, { onError: (e) => toast.error(apiErrorMessage(e)) });
            setConfirmDelete(null);
          }}
        />
      </ConfirmDialog>
    </div>
  );
}

/* ----------------------------- pieces ------------------------------- */

function dayKey(m: { createdAt: number | string }): string {
  const d = typeof m.createdAt === "number" ? new Date(m.createdAt) : new Date(m.createdAt);
  return d.toDateString();
}

function DayDivider({ createdAt }: { createdAt: string | number }) {
  const d = new Date(createdAt);
  const today = new Date();
  const label =
    d.toDateString() === today.toDateString()
      ? "Today"
      : new Date(today.getTime() - 86400000).toDateString() === d.toDateString()
        ? "Yesterday"
        : d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined });
  return (
    <div className="my-2 flex items-center gap-3" role="separator">
      <span className="h-px flex-1 bg-border" />
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function snippet(body: string): string {
  const clean = body.replace(/@\[([^\]]+)\]\([a-f0-9]{24}\)/g, "@$1").replace(/\s+/g, " ").trim();
  return clean.length > 80 ? `${clean.slice(0, 80)}…` : clean;
}

/** Render chat body: mentions, urls, line breaks. No raw HTML ever. */
export function ChatBody({ body, className }: { body: string; className?: string }) {
  const parts: React.ReactNode[] = [];
  const re = /(@\[([^\]]+)\]\([a-f0-9]{24}\))|(https?:\/\/[^\s<]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(body)) !== null) {
    if (m.index > last) parts.push(body.slice(last, m.index));
    if (m[1]) {
      parts.push(
        <span key={`mn${k++}`} className="rounded bg-primary/12 px-1 font-medium text-primary">
          @{m[2]}
        </span>
      );
    } else {
      const url = m[0];
      parts.push(
        <a key={`ln${k++}`} href={url} target="_blank" rel="noopener noreferrer" className="break-all text-primary underline underline-offset-2 hover:decoration-2">
          {url}
        </a>
      );
    }
    last = m.index + m[0].length;
  }
  if (last < body.length) parts.push(body.slice(last));
  return <p className={cn("text-[13.5px] leading-relaxed break-words whitespace-pre-wrap", className)}>{parts.length ? parts : ""}</p>;
}

function ServerMessageRow({
  message: m,
  gap,
  members,
  onReply,
  onEdit,
  onDelete,
  onReact,
  editing,
  editDraft,
  onEditDraftChange,
  editBusy,
  onEditSave,
  onCancelEdit,
}: {
  message: MessageDTO;
  gap: boolean;
  members: OrgMemberDTO[];
  onReply: (m: MessageDTO) => void;
  onEdit: (m: MessageDTO) => void;
  onDelete: (m: MessageDTO) => void;
  onReact: (m: MessageDTO, emoji: string) => void;
  editing: boolean;
  editDraft: string;
  onEditDraftChange: (v: string) => void;
  editBusy: boolean;
  onEditSave: (body: string) => void;
  onCancelEdit: () => void;
}) {
  const member = members.find((x) => x.userId === m.sender.userId);
  const [pickerOpen, setPickerOpen] = React.useState(false);

  return (
    <div className={cn("group relative flex gap-2.5 rounded-lg px-1.5 py-1 transition-colors hover:bg-muted/25", gap ? "mt-1.5" : "mt-0.5")}>
      <div className="shrink-0">
        {gap ? (
          <Avatar name={member?.name ?? m.sender.name} src={member?.avatarUrl ?? m.sender.avatarUrl} size="md" className="mt-0.5" />
        ) : (
          <span className="block w-8" aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1">
        {gap ? (
          <p className="flex items-baseline gap-2 text-[13px]">
            <span className="font-semibold">{member?.name ?? m.sender.name}</span>
            <span className="text-[11px] text-muted-foreground">{formatDateTime(m.createdAt)}</span>
          </p>
        ) : null}
        {editing ? (
          <div className="mt-0.5 space-y-1.5">
            <Textarea value={editDraft} onChange={(e) => onEditDraftChange(e.target.value)} rows={2} className="text-[13px]" autoFocus />
            <div className="flex gap-1.5">
              <Button size="sm" loading={editBusy} onClick={() => editDraft.trim() && onEditSave(editDraft.trim())}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={onCancelEdit}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            {m.type === "system" ? (
              <p className="text-xs text-muted-foreground italic">{m.body}</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {m.attachments.map((f) =>
                  f.isImage ? (
                    <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer" className="block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={f.url} alt={f.name} loading="lazy" className="max-h-48 max-w-[240px] rounded-lg border object-cover" />
                    </a>
                  ) : (
                    <a key={f.id} href={`${f.url}${f.url.includes("?") ? "&" : "?"}download=1`} download className="flex w-fit items-center gap-1.5 rounded-md border bg-card px-2 py-1.5 text-xs hover:border-primary/50">
                      <FileGlyph name={f.name} />
                      <span className="max-w-44 truncate">{f.name}</span>
                      <span className="text-[10px] text-muted-foreground">{formatBytes(f.size)}</span>
                    </a>
                  )
                )}
              </div>
            )}
            {m.body ? <ChatBody body={m.body} /> : null}
            {m.editedAt ? <p className="text-[10px] text-muted-foreground/80">(edited {formatDateTime(m.editedAt)})</p> : null}
            {m.reactions.length > 0 ? (
              <div className="mt-1 flex flex-wrap gap-1">
                {m.reactions.map((r: ReactionDTO) => (
                  <button
                    key={r.emoji}
                    type="button"
                    aria-pressed={r.reactedByMe}
                    onClick={() => onReact(m, r.emoji)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] transition-colors hover:border-primary/50",
                      r.reactedByMe ? "border-primary/60 bg-primary/10" : "border-border bg-card hover:bg-accent"
                    )}
                  >
                    <span aria-hidden>{r.emoji}</span>
                    <span className="tabular-nums text-muted-foreground">{r.count}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>

      {/* hover actions */}
      {!editing ? (
        <div className="absolute top-0.5 right-1 flex items-center gap-0.5 rounded-md border bg-card/95 opacity-0 shadow-xs transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="React" className="size-6 text-muted-foreground">
                <Smile className="size-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-1">
              <div className="flex gap-0.5">
                {QUICK_EMOJI.map((e) => (
                  <button key={e} type="button" aria-label={`React ${e}`} onClick={() => { onReact(m, e); setPickerOpen(false); }} className="rounded p-1 text-base hover:bg-accent">
                    {e}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="icon-sm" aria-label="Reply" className="size-6 text-muted-foreground" onClick={() => onReply(m)}>
            <CornerDownRight className="size-3.5" />
          </Button>
          {m.canEdit ? (
            <Button variant="ghost" size="icon-sm" aria-label="Edit" className="size-6 text-muted-foreground" onClick={() => onEdit(m)}>
              <Pencil className="size-3.5" />
            </Button>
          ) : null}
          {m.canDelete ? (
            <Button variant="ghost" size="icon-sm" aria-label="Delete" className="size-6 text-muted-foreground hover:text-destructive" onClick={() => onDelete(m)}>
              <Trash2 className="size-3.5" />
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ReplyQuote({ message }: { message: MessageDTO }) {
  const p = message.parent;
  if (!p) return null;
  return (
    <div className="flex items-center gap-2 rounded-md border-l-2 border-primary/50 bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground">
      <CornerDownRight className="size-3 shrink-0" />
      <span className="min-w-0 truncate">
        <span className="font-semibold text-foreground">{p.senderName}</span> · {snippet(p.body)}
      </span>
    </div>
  );
}

function OutboxRow({ temp, onRetry, onDismiss }: { temp: TempMessage; onRetry: (t: TempMessage) => void; onDismiss: (t: TempMessage) => void }) {
  return (
    <div className={cn("flex justify-end gap-2.5 rounded-lg px-1.5 py-1", temp.status === "error" && "bg-destructive/5")}>
      <div className="max-w-[78%]">
        {temp.status === "error" ? (
          <p className="mb-0.5 flex items-center gap-1 text-[11px] font-medium text-destructive">
            <AlertTriangle className="size-3" /> Couldn&apos;t send{temp.error ? ` — ${temp.error}` : ""}
          </p>
        ) : null}
        <div className={cn("rounded-2xl rounded-br-sm border px-3 py-1.5", temp.status === "error" ? "border-destructive/40 bg-destructive/10 text-destructive-foreground" : "border-primary/20 bg-primary/10")}>
          <ChatBody body={temp.body} className="text-[13.5px]" />
        </div>
        {temp.status === "error" ? (
          <div className="mt-1 flex justify-end gap-1.5">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onRetry(temp)}>
              Retry
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onDismiss(temp)}>
              Dismiss
            </Button>
          </div>
        ) : (
          <p className="mt-0.5 flex items-center gap-1 justify-end text-[10px] text-muted-foreground">
            <Loader2 className="size-2.5 animate-spin" /> sending
          </p>
        )}
      </div>
    </div>
  );
}

function Composer({
  members,
  meId,
  notifyTyping,
  onSend,
  onAttach,
  disabled,
}: {
  members: OrgMemberDTO[];
  meId: string | null;
  notifyTyping: () => void;
  onSend: (body: string) => void;
  onAttach: () => void;
  disabled?: boolean;
}) {
  const [value, setValue] = React.useState("");
  const [mentionOpen, setMentionOpen] = React.useState(false);
  const [mentionQuery, setMentionQuery] = React.useState("");
  const taRef = React.useRef<HTMLTextAreaElement | null>(null);

  const candidates = members.filter((mem) => {
    if (mem.userId === meId) return false;
    const q = mentionQuery.toLowerCase();
    return !q || mem.name.toLowerCase().includes(q) || mem.email.toLowerCase().includes(q);
  });

  const insertMention = (mem: OrgMemberDTO) => {
    const ta = taRef.current;
    if (!ta) return;
    const caret = ta.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const atIdx = before.lastIndexOf("@");
    const token = `@[${mem.name}](${mem.userId}) `;
    const next = `${before.slice(0, atIdx)}${token}${value.slice(caret)}`;
    setValue(next);
    setMentionOpen(false);
    requestAnimationFrame(() => {
      const pos = atIdx + token.length;
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  };

  const onChange = (v: string) => {
    setValue(v);
    const ta = taRef.current;
    const caret = ta?.selectionStart ?? v.length;
    const before = v.slice(0, caret);
    const m = before.match(/@([\p{L}\p{N}_\- ]*)$/u);
    if (m && m[1].trim().length > 0 && before.lastIndexOf("@") >= Math.max(before.lastIndexOf(" "), before.lastIndexOf("\n"))) {
      setMentionQuery(m[1].trim());
      setMentionOpen(true);
      return;
    }
    setMentionOpen(false);
  };

  const submit = () => {
    const body = value.trim();
    if (!body || disabled) return;
    onSend(body);
    setValue("");
    setMentionOpen(false);
    requestAnimationFrame(() => taRef.current?.focus());
  };

  return (
    <div className="relative">
      <div className="flex items-end gap-1.5 rounded-xl border bg-background/60 px-2 py-1.5 transition-colors focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20">
        <Button variant="ghost" size="icon-sm" type="button" aria-label="Attach files" onClick={onAttach} className="mb-0.5 shrink-0 text-muted-foreground hover:text-foreground">
          <Plus className="size-4" />
        </Button>
        <Textarea
          ref={taRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (e.target.value.trim()) notifyTyping();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
            if (e.key === "Escape" && mentionOpen) setMentionOpen(false);
          }}
          placeholder="Message…"
          rows={1}
          className="max-h-36 min-h-9 flex-1 resize-none border-0 bg-transparent px-1 py-1.5 text-[13.5px] shadow-none focus-visible:ring-0"
        />
        <Button type="button" size="icon-sm" aria-label="Send message" disabled={!value.trim() || disabled} onClick={submit} className="mb-0.5 shrink-0">
          <Send className="size-4" />
        </Button>
      </div>

      {mentionOpen && candidates.length > 0 ? (
        <div className="absolute bottom-full left-2 z-20 mb-1 w-72 overflow-hidden rounded-lg border bg-popover shadow-lg">
          <p className="border-b bg-muted/40 px-2.5 py-1 text-[10px] font-medium text-muted-foreground uppercase">Mention someone</p>
          <div className="max-h-52 overflow-y-auto p-0.5">
            {candidates.slice(0, 12).map((mem) => (
              <button
                key={mem.userId}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(mem);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-accent"
              >
                <Avatar name={mem.name} src={mem.avatarUrl} size="xs" />
                <span className="min-w-0 flex-1 truncate">{mem.name}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">@{mem.name.split(" ")[0]?.toLowerCase()}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Lightweight message search inside chat (org-wide, opens matching conversation). */
function ChatSearchButton({ orgId }: { orgId: string }) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const router = useRouter();
  const results = useQuery({
    queryKey: qk.search(orgId, q.trim() || " "),
    queryFn: () =>
      apiFetch<{
        messages: { id: string; body: string; conversationId: string; conversationName: string; projectId: string | null }[];
      }>(`/api/search?orgId=${encodeURIComponent(orgId)}&q=${encodeURIComponent(q)}`).then((d) => d.messages),
    enabled: open && q.trim().length >= 2,
  });

  return (
    <>
      <Button variant="ghost" size="icon-sm" aria-label="Search messages" onClick={() => setOpen(true)} className="text-muted-foreground">
        <Search className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogTitle className="text-base font-semibold">Search messages</DialogTitle>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
            placeholder="Search all messages in this workspace…"
            className="h-10 w-full rounded-md border bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {q.trim().length < 2 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">Type at least 2 characters.</p>
            ) : results.isLoading ? (
              <p className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Searching…
              </p>
            ) : results.isError ? (
              <p className="py-4 text-center text-xs text-destructive">Search failed. Try again.</p>
            ) : (results.data ?? []).length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">No matching messages.</p>
            ) : (
              results.data!.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    router.push(`/chat/${m.conversationId}`);
                  }}
                  className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-accent"
                >
                  <FileText className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold">{m.conversationName}</span>
                      {m.projectId ? <span className="shrink-0 text-[10px] text-muted-foreground">project</span> : null}
                    </span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">{snippet(m.body)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ThreadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const message = error instanceof Error ? error.message : "Couldn't load this conversation.";
  const isMissing = /not found|no longer|can't see/i.test(message);
  return (
    <div className="flex h-full min-h-48 flex-col items-center justify-center gap-3 text-center">
      <AlertTriangle className="size-8 text-muted-foreground/50" />
      <div>
        <p className="text-sm font-medium">{isMissing ? "Conversation unavailable" : "Couldn't load messages"}</p>
        <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted-foreground">{message}</p>
      </div>
      {!isMissing ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function FileGlyph({ name }: { name: string }) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const color =
    ["png", "jpg", "jpeg", "gif", "webp", "svg", "pdf"].includes(ext)
      ? "text-red-500"
      : ["mp4", "mov", "mp3", "wav"].includes(ext)
        ? "text-violet-500"
        : ["zip", "rar", "7z"].includes(ext)
          ? "text-amber-500"
          : "text-muted-foreground";
  return <FileText className={cn("size-4 shrink-0", color)} aria-hidden />;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Upload helper with progress via XHR. */
export function xhrUpload(url: string, fd: FormData, onProgress?: (pct: number) => void): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const parsed = JSON.parse(xhr.responseText) as unknown;
        if (xhr.status >= 200 && xhr.status < 300) resolve(parsed);
        else reject(new Error((parsed as { error?: { message?: string } }).error?.message ?? `Upload failed (${xhr.status})`));
      } catch {
        reject(new Error("Upload failed."));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.send(fd);
  });
}
