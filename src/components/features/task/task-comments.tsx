"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CornerDownRight, Edit3, Loader2, MessageSquare, Plus, Send, Smile, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ConfirmDialog, ConfirmDialogContent } from "@/components/ui/confirm-dialog";
import { Markdown } from "@/lib/markdown";
import { cn, timeAgo } from "@/lib/utils";
import { toast } from "sonner";
import type { CommentDTO, ProjectMemberDTO } from "@/types";

const EMOJI = ["👍", "❤️", "🎉", "🔥", "👀", "😂", "🚀", "✅"];

export function TaskComments({
  orgId,
  projectId,
  taskId,
  members,
  meId,
  canComment,
}: {
  orgId: string;
  projectId: string;
  taskId: string;
  members: ProjectMemberDTO[];
  meId: string | null;
  canComment: boolean;
}) {
  const qc = useQueryClient();
  const [page, setPage] = React.useState(1);
  const list = useQuery({
    queryKey: [...qk.comments(orgId, projectId, taskId), page],
    queryFn: () =>
      apiFetch<{ items: CommentDTO[]; total: number; hasMore: boolean }>(
        `/api/projects/${projectId}/tasks/${taskId}/comments?page=${page}`
      ),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: qk.comments(orgId, projectId, taskId) });
    qc.invalidateQueries({ queryKey: qk.task(orgId, projectId, taskId) });
  };

  // ----- mutations -----
  const add = useMutation({
    mutationFn: ({ body, parentId }: { body: string; parentId?: string }) =>
      apiFetch(`/api/projects/${projectId}/tasks/${taskId}/comments`, {
        method: "POST",
        body: JSON.stringify({ body, parentId: parentId ?? null }),
      }),
    onSuccess: invalidate,
  });
  const edit = useMutation({
    mutationFn: ({ commentId, body }: { commentId: string; body: string }) =>
      apiFetch(`/api/projects/${projectId}/tasks/${taskId}/comments/${commentId}`, {
        method: "PATCH",
        body: JSON.stringify({ body }),
      }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (commentId: string) =>
      apiFetch(`/api/projects/${projectId}/tasks/${taskId}/comments/${commentId}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
  const react = useMutation({
    mutationFn: ({ commentId, emoji }: { commentId: string; emoji: string }) =>
      apiFetch(`/api/projects/${projectId}/tasks/${taskId}/comments/${commentId}/reactions`, {
        method: "POST",
        body: JSON.stringify({ emoji }),
      }),
    onSuccess: invalidate,
  });

  const items = list.data?.items ?? [];
  const [confirmDelete, setConfirmDelete] = React.useState<CommentDTO | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <MessageSquare className="size-4 text-muted-foreground" aria-hidden />
        Comments
        <span className="text-xs font-normal text-muted-foreground tabular-nums">
          {list.data ? list.data.total : ""}
        </span>
      </div>

      {canComment ? (
        <Composer
          members={members}
          meId={meId}
          placeholder="Write a comment… use @ to mention someone, **bold** and `code` work too"
          submitLabel="Comment"
          onSubmit={(body) => add.mutate({ body }, { onError: (e) => toast.error(msg(e)) })}
          pending={add.isPending}
        />
      ) : null}

      {list.isLoading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-secondary/50" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          No comments yet{canComment ? " — start the discussion." : "."}
        </p>
      ) : (
        <ul className="space-y-0 divide-y">
          {items.filter((c) => !c.parentId).map((c) => (
            <CommentNode
              key={c.id}
              comment={c}
              replies={items.filter((r) => r.parentId === c.id)}
              members={members}
              meId={meId}
              onReply={(parentId, body) => add.mutate({ body, parentId }, { onError: (e) => toast.error(msg(e)) })}
              onEdit={(commentId, body) => edit.mutate({ commentId, body }, { onError: (e) => toast.error(msg(e)) })}
              onDelete={(commentId) => setConfirmDelete(items.find((x) => x.id === commentId) ?? null)}
              onReact={(commentId, emoji) => react.mutate({ commentId, emoji })}
              canComment={canComment}
            />
          ))}
        </ul>
      )}

      {list.data?.hasMore ? (
        <Button variant="outline" size="sm" className="self-center" onClick={() => setPage((p) => p + 1)}>
          {list.isFetching ? <Loader2 className="size-3.5 animate-spin" /> : null} Load earlier comments
        </Button>
      ) : null}

      <ConfirmDialog open={Boolean(confirmDelete)} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <ConfirmDialogContent
          title="Delete comment?"
          description="This removes the comment for everyone. Replies stay but are detached."
          confirmLabel="Delete"
          destructive
          loading={remove.isPending}
          onConfirm={() => {
            if (confirmDelete) remove.mutate(confirmDelete.id);
            setConfirmDelete(null);
          }}
        />
      </ConfirmDialog>
    </div>
  );
}

function CommentNode({
  comment: c,
  replies,
  members,
  meId,
  onReply,
  onEdit,
  onDelete,
  onReact,
  canComment,
}: {
  comment: CommentDTO;
  replies: CommentDTO[];
  members: ProjectMemberDTO[];
  meId: string | null;
  onReply: (parentId: string, body: string) => void;
  onEdit: (commentId: string, body: string) => void;
  onDelete: (commentId: string) => void;
  onReact: (commentId: string, emoji: string) => void;
  canComment: boolean;
}) {
  const [replying, setReplying] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [showReactions, setShowReactions] = React.useState(false);
  const isMine = meId === c.author.userId;

  return (
    <li className="flex gap-2.5 py-3 first:pt-0">
      <Avatar name={c.author.name} src={c.author.avatarUrl} size="sm" className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[13px] font-semibold">{c.author.name}</span>
          {isMine ? <span className="rounded bg-muted px-1 text-[9px] font-semibold text-muted-foreground uppercase">you</span> : null}
          <span className="text-[11px] text-muted-foreground">{timeAgo(c.createdAt)}</span>
          {c.editedAt ? <span className="text-[10px] text-muted-foreground/70">edited</span> : null}
          <span className="ml-auto flex items-center gap-0.5">
            <Popover open={showReactions} onOpenChange={setShowReactions}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Add reaction" className="size-6 text-muted-foreground">
                  <Smile className="size-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-auto p-1">
                <div className="flex gap-0.5">
                  {EMOJI.map((e) => (
                    <button
                      key={e}
                      type="button"
                      aria-label={`React with ${e}`}
                      onClick={() => {
                        onReact(c.id, e);
                        setShowReactions(false);
                      }}
                      className="rounded p-1 text-base hover:bg-accent"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            {canComment ? (
              <Button variant="ghost" size="icon-sm" aria-label="Reply" className="size-6 text-muted-foreground" onClick={() => setReplying((v) => !v)}>
                <CornerDownRight className="size-3.5" />
              </Button>
            ) : null}
            {c.canEdit && !editing ? (
              <Button variant="ghost" size="icon-sm" aria-label="Edit comment" className="size-6 text-muted-foreground" onClick={() => setEditing(true)}>
                <Edit3 className="size-3.5" />
              </Button>
            ) : null}
            {c.canDelete ? (
              <Button variant="ghost" size="icon-sm" aria-label="Delete comment" className="size-6 text-muted-foreground hover:text-destructive" onClick={() => onDelete(c.id)}>
                <Trash2 className="size-3.5" />
              </Button>
            ) : null}
          </span>
        </div>

        {editing ? (
          <InlineEdit
            initial={c.body}
            onCancel={() => setEditing(false)}
            onSubmit={(body) => {
              onEdit(c.id, body);
              setEditing(false);
            }}
          />
        ) : (
          <Markdown className="mt-0.5 text-[13px] leading-relaxed">{c.body}</Markdown>
        )}

        {c.reactions.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {c.reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                onClick={() => onReact(c.id, r.emoji)}
                aria-pressed={r.reactedByMe}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] transition-colors hover:border-primary/50",
                  r.reactedByMe ? "border-primary/60 bg-primary/10" : ""
                )}
              >
                <span aria-hidden>{r.emoji}</span>
                <span className="tabular-nums text-muted-foreground">{r.count}</span>
              </button>
            ))}
          </div>
        ) : null}

        {replying ? (
          <div className="mt-2">
            <Composer
              members={members}
              meId={meId}
              compact
              autoFocus
              placeholder="Reply…"
              submitLabel="Reply"
              onSubmit={(body) => {
                onReply(c.id, body);
                setReplying(false);
              }}
              onCancel={() => setReplying(false)}
            />
          </div>
        ) : null}

        {replies.length > 0 ? (
          <ul className="mt-1.5 space-y-1 border-l pl-3">
            {replies.map((r) => (
              <CommentNode
                key={r.id}
                comment={r}
                replies={[]}
                members={members}
                meId={meId}
                onReply={() => undefined}
                onEdit={onEdit}
                onDelete={onDelete}
                onReact={onReact}
                canComment={canComment}
              />
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}

function InlineEdit({ initial, onCancel, onSubmit }: { initial: string; onCancel: () => void; onSubmit: (body: string) => void }) {
  const [value, setValue] = React.useState(initial);
  return (
    <div className="mt-1 space-y-1.5">
      <Textarea value={value} onChange={(e) => setValue(e.target.value)} rows={3} className="text-[13px]" autoFocus />
      <div className="flex gap-1.5">
        <Button size="sm" onClick={() => onSubmit(value.trim())}>Save</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

/** Mention-aware comment composer (the picker just completes @Name tokens — resolution is server-side). */
function Composer({
  members,
  meId,
  compact,
  autoFocus,
  placeholder,
  submitLabel,
  onSubmit,
  onCancel,
  pending,
}: {
  members: ProjectMemberDTO[];
  meId: string | null;
  compact?: boolean;
  autoFocus?: boolean;
  placeholder: string;
  submitLabel: string;
  onSubmit: (body: string) => void;
  onCancel?: () => void;
  pending?: boolean;
}) {
  const [value, setValue] = React.useState("");
  const [mentionOpen, setMentionOpen] = React.useState(false);
  const [mentionQuery, setMentionQuery] = React.useState("");
  const taRef = React.useRef<HTMLTextAreaElement | null>(null);

  const updateWithMention = (name: string) => {
    const ta = taRef.current;
    if (!ta) return;
    const caret = ta.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const atIdx = before.lastIndexOf("@");
    if (atIdx === -1) return;
    const next = `${before.slice(0, atIdx)}@${name} ${value.slice(caret)}`;
    setValue(next);
    setMentionOpen(false);
    requestAnimationFrame(() => {
      const pos = atIdx + 1 + name.length + 1;
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  };

  const onChange = (v: string) => {
    setValue(v);
    const ta = taRef.current;
    const caret = ta?.selectionStart ?? v.length;
    const before = v.slice(0, caret);
    const m = before.match(/@([\p{L}\p{N}_]+)$/u);
    if (m) {
      setMentionQuery(m[1]);
      setMentionOpen(true);
      return;
    }
    setMentionOpen(false);
  };

  const filtered = members.filter((mem) => {
    if (meId && mem.userId === meId) return false;
    const q = mentionQuery.toLowerCase();
    return !q || mem.name.toLowerCase().includes(q) || mem.email.toLowerCase().includes(q);
  });

  const submit = () => {
    const body = value.trim();
    if (!body) return;
    onSubmit(body);
    setValue("");
    setMentionOpen(false);
  };

  return (
    <div className="relative">
      <div className="rounded-lg border bg-card transition-colors focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-ring/30">
        <Textarea
          ref={taRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={compact ? 2 : 3}
          autoFocus={autoFocus}
          className="border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <div className="flex items-center justify-between px-2 pb-1.5">
          <span className="text-[10px] text-muted-foreground/70">Ctrl/⌘ + Enter to send · markdown supported</span>
          <div className="flex items-center gap-1">
            {onCancel ? (
              <Button size="sm" variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            ) : null}
            <Button size="sm" onClick={submit} disabled={!value.trim() || pending}>
              {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
              {submitLabel}
            </Button>
          </div>
        </div>
      </div>

      {mentionOpen && filtered.length > 0 ? (
        <div className="absolute bottom-full left-0 z-20 mb-1 max-h-44 w-64 overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg">
          {filtered.map((mem) => (
            <button
              key={mem.userId}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                updateWithMention(mem.name);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-accent"
            >
              <Avatar name={mem.name} src={mem.avatarUrl} size="xs" />
              <span className="min-w-0 flex-1 truncate">{mem.name}</span>
              <Check className="size-3.5 text-muted-foreground opacity-0" aria-hidden />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong.";
}
