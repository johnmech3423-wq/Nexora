"use client";

import * as React from "react";
import {
  AlertCircle,
  Bot,
  Copy,
  Loader2,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  User,
  Check,
  FolderKanban,
  Clock3,
  AlertTriangle,
  BarChart3,
  ShieldCheck,
  X,
  Clock,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, ApiClientError, qs } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { useActiveOrgId, useActiveOrg } from "@/lib/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Markdown } from "@/lib/markdown";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PlanGateCard } from "@/components/features/plan-gate";
import { EmptyState } from "@/components/ui/state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProjectSummaryDTO } from "@/types";

type Role = "user" | "assistant";

interface ProposedAction {
  id: string;
  tool: "create_task" | "create_subtasks" | "update_task";
  message: string;
  args: Record<string, unknown>;
  projectKey?: string;
  expiresAt: string;
}

interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: string;
  provider?: string | null;
  model?: string | null;
  fallback?: boolean;
  usageToday?: number;
  limitToday?: number;
  contextUsed?: {
    orgName: string;
    projectCount: number;
    taskCounts: { total: number; open: number; overdue: number; inProgress: number; completed: number };
    hasProjectContext: boolean;
  };
  actions?: { tool: string; ok: boolean; message: string; data?: unknown }[];
  proposedActions?: ProposedAction[];
}

interface ApiReply {
  reply: string;
  provider: string;
  model: string | null;
  fallback: boolean;
  usageToday: number;
  limitToday: number;
  contextUsed?: ChatMessage["contextUsed"];
  actions?: ChatMessage["actions"];
  proposedActions?: ProposedAction[];
}

interface ConfirmResponse {
  ok: boolean;
  tool: string;
  message: string;
  data?: unknown;
  errorCode?: string;
}

const SUGGESTED_PROMPTS = [
  "Summarize my workspace",
  "What needs attention?",
  "Which tasks are overdue?",
  "How are our projects progressing?",
  "What is blocking the team?",
  "Who appears overloaded?",
  "Show recent progress",
  "What changed recently?",
] as const;

const PROJECT_PROMPTS = [
  "Summarize this project",
  "What are the main risks?",
  "Which tasks are overdue in this project?",
  "What should we focus on next?",
  "Create a task for bug triage",
  "Break the last task into subtasks",
] as const;

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function useProjects(orgId: string | null) {
  return useQuery({
    queryKey: qk.projects(orgId ?? "x", "ai-context"),
    queryFn: () =>
      apiFetch<{ items: ProjectSummaryDTO[]; total: number }>(
        `/api/projects${qs({ orgId, pageSize: 50, sort: "updated" })}`
      ),
    enabled: Boolean(orgId),
    staleTime: 60_000,
  });
}

export function AiAssistant() {
  const orgId = useActiveOrgId();
  const { activeOrg } = useActiveOrg();
  const projectsQuery = useProjects(orgId);
  const [selectedProjectId, setSelectedProjectId] = React.useState<string | null>(null);

  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [isSending, setIsSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastFailedUserMessage, setLastFailedUserMessage] = React.useState<string | null>(null);
  const [usage, setUsage] = React.useState<{ used: number; limit: number } | null>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [lastContext, setLastContext] = React.useState<ChatMessage["contextUsed"] | null>(null);
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  // Track status of proposed actions: pending, approving, executed, rejected, expired, error
  const [actionStates, setActionStates] = React.useState<
    Record<string, { status: "pending" | "approving" | "rejecting" | "executed" | "rejected" | "expired" | "error"; result?: ConfirmResponse; error?: string }>
  >({});

  // Auto-scroll to bottom when messages change
  React.useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, isSending]);

  // Focus composer on mount
  React.useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Reset project selection when org changes — async to avoid cascading render lint
  React.useEffect(() => {
    const t = setTimeout(() => setSelectedProjectId(null), 0);
    return () => clearTimeout(t);
  }, [orgId]);

  const clearConversation = React.useCallback(() => {
    setMessages([]);
    setError(null);
    setLastFailedUserMessage(null);
    setInput("");
    setLastContext(null);
    setActionStates({});
    toast.success("Conversation cleared");
  }, []);

  const copyToClipboard = React.useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Could not copy");
    }
  }, []);

  const send = React.useCallback(
    async (text: string, opts?: { isRetry?: boolean }) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (!orgId) {
        setError("Select a workspace to use the AI assistant.");
        return;
      }
      if (isSending) return;

      setError(null);
      setIsSending(true);

      const userMsg: ChatMessage = {
        id: uid(),
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
      };

      if (!opts?.isRetry) {
        setMessages((prev) => [...prev, userMsg]);
        setInput("");
      }

      try {
        const data = await apiFetch<ApiReply>(`/api/ai/chat?orgId=${encodeURIComponent(orgId)}`, {
          method: "POST",
          body: {
            message: trimmed,
            feature: "assistant",
            projectId: selectedProjectId ?? undefined,
          },
        });

        const assistantMsg: ChatMessage = {
          id: uid(),
          role: "assistant",
          content: data.reply,
          createdAt: new Date().toISOString(),
          provider: data.provider,
          model: data.model,
          fallback: data.fallback,
          usageToday: data.usageToday,
          limitToday: data.limitToday,
          contextUsed: data.contextUsed,
          actions: data.actions,
          proposedActions: data.proposedActions,
        };

        // Initialize action states as pending
        if (data.proposedActions?.length) {
          setActionStates((prev) => {
            const next = { ...prev };
            for (const pa of data.proposedActions!) {
              if (!next[pa.id]) next[pa.id] = { status: "pending" };
            }
            return next;
          });
        }

        setMessages((prev) => [...prev, assistantMsg]);
        setUsage({ used: data.usageToday, limit: data.limitToday });
        setLastContext(data.contextUsed ?? null);
        setLastFailedUserMessage(null);
      } catch (e) {
        const message =
          e instanceof ApiClientError
            ? e.message
            : e instanceof Error
              ? e.message
              : "Something went wrong. Please try again.";
        setError(message);
        setLastFailedUserMessage(trimmed);
      } finally {
        setIsSending(false);
        requestAnimationFrame(() => textareaRef.current?.focus());
      }
    },
    [orgId, isSending, selectedProjectId]
  );

  const confirmAction = React.useCallback(
    async (actionId: string) => {
      if (!orgId) return;
      if (actionStates[actionId]?.status === "approving" || actionStates[actionId]?.status === "executed") return;

      setActionStates((prev) => ({ ...prev, [actionId]: { status: "approving" } }));
      try {
        const res = await apiFetch<ConfirmResponse>(`/api/ai/actions/${encodeURIComponent(actionId)}/confirm?orgId=${encodeURIComponent(orgId)}`, {
          method: "POST",
        });
        setActionStates((prev) => ({
          ...prev,
          [actionId]: { status: res.ok ? "executed" : "error", result: res, error: res.ok ? undefined : res.message },
        }));
        if (res.ok) toast.success(res.message);
        else toast.error(res.message);
      } catch (e) {
        const msg = e instanceof ApiClientError ? e.message : e instanceof Error ? e.message : "Failed to confirm action.";
        const isExpired = msg.toLowerCase().includes("expired");
        const isConflict = msg.toLowerCase().includes("already") || msg.toLowerCase().includes("executed") || msg.toLowerCase().includes("rejected");
        setActionStates((prev) => ({
          ...prev,
          [actionId]: {
            status: isExpired ? "expired" : isConflict ? "error" : "error",
            error: msg,
          },
        }));
        toast.error(msg);
      }
    },
    [orgId, actionStates]
  );

  const rejectAction = React.useCallback(
    async (actionId: string) => {
      if (!orgId) return;
      if (actionStates[actionId]?.status === "rejecting" || actionStates[actionId]?.status === "rejected") return;

      setActionStates((prev) => ({ ...prev, [actionId]: { status: "rejecting" } }));
      try {
        await apiFetch(`/api/ai/actions/${encodeURIComponent(actionId)}/reject?orgId=${encodeURIComponent(orgId)}`, {
          method: "POST",
        });
        setActionStates((prev) => ({ ...prev, [actionId]: { status: "rejected" } }));
        toast.success("Action rejected — no changes made.");
      } catch (e) {
        const msg = e instanceof ApiClientError ? e.message : e instanceof Error ? e.message : "Failed to reject action.";
        setActionStates((prev) => ({ ...prev, [actionId]: { status: "error", error: msg } }));
        toast.error(msg);
      }
    },
    [orgId, actionStates]
  );

  const onSubmit = React.useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      void send(input);
    },
    [input, send]
  );

  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void send(input);
      }
    },
    [input, send]
  );

  const handlePromptClick = React.useCallback(
    (prompt: string) => {
      if (isSending) return;
      void send(prompt);
    },
    [isSending, send]
  );

  if (!orgId) {
    return (
      <div className="space-y-6">
        <Header
          orgName={activeOrg?.name ?? null}
          usage={usage}
          onClear={clearConversation}
          hasMessages={messages.length > 0}
          disabled
          projectCount={0}
          taskCounts={null}
          selectedProjectId={selectedProjectId}
          onProjectChange={setSelectedProjectId}
          projects={[]}
          context={lastContext ?? null}
        />
        <EmptyState
          icon={Sparkles}
          title="No workspace selected"
          description="Pick a workspace from the switcher to start chatting with the Nexora AI assistant. Your assistant is scoped to the active workspace only."
        />
      </div>
    );
  }

  const projects = projectsQuery.data?.items ?? [];

  return (
    <div className="flex h-[calc(100dvh-7rem)] min-h-[520px] flex-col gap-4 md:h-[calc(100dvh-8rem)]">
      <Header
        orgName={activeOrg?.name ?? null}
        usage={usage}
        onClear={clearConversation}
        hasMessages={messages.length > 0}
        disabled={isSending}
        projectCount={lastContext?.projectCount ?? projects.length}
        taskCounts={lastContext?.taskCounts ?? null}
        selectedProjectId={selectedProjectId}
        onProjectChange={setSelectedProjectId}
        projects={projects}
        context={lastContext ?? null}
      />

      {/* Error banner */}
      {error ? (
        <ErrorBanner
          message={error}
          onRetry={() => (lastFailedUserMessage ? void send(lastFailedUserMessage, { isRetry: true }) : null)}
          onDismiss={() => setError(null)}
          orgId={orgId}
        />
      ) : null}

      {/* Messages area */}
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto scroll-smooth"
          role="log"
          aria-live="polite"
          aria-label="Conversation"
        >
          {messages.length === 0 ? (
            <EmptyConversation
              onPrompt={handlePromptClick}
              disabled={isSending}
              hasProject={Boolean(selectedProjectId)}
              projectName={projects.find((p) => p.id === selectedProjectId)?.name ?? null}
            />
          ) : (
            <div className="divide-y">
              {messages.map((m) => (
                <MessageRow
                  key={m.id}
                  message={m}
                  onCopy={copyToClipboard}
                  copied={copiedId === m.id}
                  actionStates={actionStates}
                  onConfirm={confirmAction}
                  onReject={rejectAction}
                />
              ))}
              {isSending ? (
                <div className="flex gap-3 p-4">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Bot className="size-4 text-primary" aria-hidden />
                  </span>
                  <div className="flex items-center gap-2 rounded-2xl border bg-card px-4 py-2.5 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Building workspace context and thinking…
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="border-t bg-card p-3 sm:p-4">
          <form onSubmit={onSubmit} className="flex items-end gap-2">
            <div className="relative flex-1">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={
                  isSending
                    ? "Assistant is responding…"
                    : selectedProjectId
                      ? `Ask about ${projects.find((p) => p.id === selectedProjectId)?.name ?? "this project"}… (Shift+Enter for new line)`
                      : "Ask about your workspace, tasks, or projects… (Shift+Enter for new line)"
                }
                rows={1}
                disabled={isSending}
                className="min-h-[44px] max-h-[160px] resize-none pr-10 text-[14px] leading-6"
                aria-label="Message"
              />
              <div className="pointer-events-none absolute bottom-2 right-2 hidden text-[10px] text-muted-foreground/60 sm:block">
                ↵ to send
              </div>
            </div>
            <Button
              type="submit"
              disabled={!input.trim() || isSending}
              loading={isSending}
              aria-label="Send message"
              className="h-[44px] shrink-0 px-4"
            >
              <Send className="size-4" />
              <span className="hidden sm:inline">Send</span>
            </Button>
          </form>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-[11px] leading-4 text-muted-foreground">
            <span>AI responses are generated and may be inaccurate. Workspace content is treated as untrusted data, never as instructions. Mutations require explicit approval.</span>
            {usage ? (
              <Badge variant="outline" className="tabular-nums text-[10px]">
                {usage.used}/{usage.limit} today
              </Badge>
            ) : null}
            {lastContext ? (
              <Badge variant="secondary" className="gap-1 text-[10px]">
                <BarChart3 className="size-3" /> Context: {lastContext.orgName} · {lastContext.projectCount} projects · {lastContext.taskCounts.open} open
                {lastContext.hasProjectContext ? " · project focused" : ""}
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-[10px]">
                <FolderKanban className="size-3" /> Workspace context enabled
              </Badge>
            )}
            <Badge variant="outline" className="gap-1 text-[10px]">
              <ShieldCheck className="size-3" /> Human confirmation required
            </Badge>
          </p>
        </div>
      </Card>
    </div>
  );
}

function Header({
  orgName,
  usage,
  onClear,
  hasMessages,
  disabled,
  projectCount,
  taskCounts,
  selectedProjectId,
  onProjectChange,
  projects,
  context,
}: {
  orgName: string | null;
  usage: { used: number; limit: number } | null;
  onClear: () => void;
  hasMessages: boolean;
  disabled?: boolean;
  projectCount: number;
  taskCounts: { total: number; open: number; overdue: number; inProgress: number; completed: number } | null;
  selectedProjectId: string | null;
  onProjectChange: (id: string | null) => void;
  projects: ProjectSummaryDTO[];
  context: { orgName: string; projectCount: number; taskCounts: { total: number; open: number; overdue: number; inProgress: number; completed: number }; hasProjectContext: boolean } | null;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="size-4" aria-hidden />
          </span>
          AI Assistant
          <Badge variant="secondary" className="ml-1 gap-1 text-[10px] font-medium">
            <BarChart3 className="size-3" /> Context-aware
          </Badge>
          <Badge variant="outline" className="ml-1 gap-1 text-[10px] font-medium">
            <ShieldCheck className="size-3" /> Confirmation required
          </Badge>
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Ask about your workspace, overdue work, project health, or recent progress. Responses stay scoped to{" "}
          {orgName ? <span className="font-medium text-foreground">{orgName}</span> : "your active workspace"} and never expose provider
          secrets. All mutations require explicit approval.
        </p>
        {taskCounts ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1 text-[11px]">
              <FolderKanban className="size-3" /> {projectCount} projects
            </Badge>
            <Badge variant="outline" className="gap-1 text-[11px]">
              <Clock3 className="size-3" /> {taskCounts.open} open
            </Badge>
            {taskCounts.overdue > 0 ? (
              <Badge variant="destructive" className="gap-1 text-[11px]">
                <AlertTriangle className="size-3" /> {taskCounts.overdue} overdue
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-[11px]">
                {taskCounts.overdue} overdue
              </Badge>
            )}
            <Badge variant="outline" className="gap-1 text-[11px]">
              {taskCounts.inProgress} in progress
            </Badge>
            {context?.hasProjectContext ? (
              <Badge variant="secondary" className="gap-1 text-[11px]">
                Project context active
              </Badge>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <Select
            value={selectedProjectId ?? "all"}
            onValueChange={(v) => onProjectChange(v === "all" ? null : v)}
            disabled={disabled}
          >
            <SelectTrigger className="h-8 w-[180px] text-xs">
              <SelectValue placeholder="All projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects (workspace)</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  [{p.key}] {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {usage ? (
          <Badge variant="outline" className="tabular-nums">
            {usage.used}/{usage.limit} today
          </Badge>
        ) : null}
        <Button variant="outline" size="sm" onClick={onClear} disabled={!hasMessages || disabled} aria-label="Clear conversation">
          <Trash2 className="size-4" />
          <span className="hidden sm:inline">Clear</span>
        </Button>
      </div>
    </div>
  );
}

function EmptyConversation({
  onPrompt,
  disabled,
  hasProject,
  projectName,
}: {
  onPrompt: (p: string) => void;
  disabled?: boolean;
  hasProject: boolean;
  projectName: string | null;
}) {
  const prompts = hasProject ? [...PROJECT_PROMPTS, ...SUGGESTED_PROMPTS.slice(0, 4)] : SUGGESTED_PROMPTS;
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center sm:p-10">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
          <Bot className="size-7 text-primary" aria-hidden />
        </span>
        <div className="max-w-md">
          <h2 className="text-base font-semibold">
            {hasProject ? `Ask about ${projectName ?? "this project"}` : "How can I help today?"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your assistant is now <span className="font-medium text-foreground">context-aware</span> — it reads real project, task, sprint,
            and workload data from your active workspace (bounded, permission-checked). Mutations require explicit approval.
          </p>
        </div>

        <div className="grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
          {prompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={disabled}
              onClick={() => onPrompt(prompt)}
              className="group rounded-lg border bg-card px-4 py-3 text-left text-sm font-medium shadow-xs transition-colors hover:border-primary/40 hover:bg-accent disabled:opacity-50"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="size-4 text-muted-foreground group-hover:text-primary" aria-hidden />
                {prompt}
              </span>
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                {prompt === "Summarize my workspace" && "Real counts: projects, open/overdue/in-progress tasks."}
                {prompt === "What needs attention?" && "Overdue + high priority + blocked work from live data."}
                {prompt === "Which tasks are overdue?" && "Up to 10 overdue tasks with assignee & project."}
                {prompt === "How are our projects progressing?" && "Progress % and overdue per project."}
                {prompt === "What is blocking the team?" && "In-progress tasks and recent activity."}
                {prompt === "Who appears overloaded?" && "Workload by open/in-progress/overdue per member."}
                {prompt === "Show recent progress" && "Completed tasks and recent activity."}
                {prompt === "What changed recently?" && "Recent tasks and activity log."}
                {prompt === "Summarize this project" && "Open/done/overdue + sprints + milestones for selected project."}
                {prompt === "What are the main risks?" && "Overdue, low progress, blocked sprints."}
                {prompt === "Which tasks are overdue in this project?" && "Filtered to selected project context."}
                {prompt === "What should we focus on next?" && "Recommendations based on real overdue & workload."}
                {prompt === "Create a task for bug triage" && "Proposes a task — requires your approval before creation."}
                {prompt === "Break the last task into subtasks" && "Proposes subtasks — requires approval."}
              </span>
            </button>
          ))}
        </div>

        <Card className="mt-2 w-full max-w-2xl border-dashed bg-muted/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShieldCheck className="size-4" /> Confirmation required, secure by design
            </CardTitle>
            <CardDescription className="text-xs">
              Context is built server-side with bounded queries. All workspace text is treated as{" "}
              <span className="font-medium">untrusted data</span>. Mutations are never executed automatically — every AI-proposed
              create/update requires explicit human approval. Pending actions expire after 10 minutes and are bound to your user + workspace.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}

function getStringArg(args: Record<string, unknown>, key: string): string | null {
  const v = args[key];
  return typeof v === "string" ? v : null;
}

function getSubtasks(args: Record<string, unknown>): { title: string }[] {
  const v = args["subtasks"];
  if (!Array.isArray(v)) return [];
  return v
    .filter((x) => x && typeof x === "object" && typeof (x as Record<string, unknown>).title === "string")
    .map((x) => ({ title: String((x as Record<string, unknown>).title) }));
}

function MessageRow({
  message,
  onCopy,
  copied,
  actionStates,
  onConfirm,
  onReject,
}: {
  message: ChatMessage;
  onCopy: (text: string, id: string) => void;
  copied: boolean;
  actionStates: Record<string, { status: string; result?: ConfirmResponse; error?: string }>;
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-3 p-4", isUser ? "bg-muted/20" : "bg-card")}>
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
        )}
        aria-hidden
      >
        {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-semibold">{isUser ? "You" : "Nexora AI"}</span>
          <span className="text-[11px] text-muted-foreground">
            {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          {!isUser && message.fallback ? (
            <Badge variant="outline" className="gap-1 text-[10px]">
              <AlertCircle className="size-3" /> {message.contextUsed ? "Deterministic snapshot" : "Guidance mode"}
            </Badge>
          ) : null}
          {!isUser && message.provider && message.provider !== "none" ? (
            <Badge variant="secondary" className="text-[10px]">
              {message.provider}
              {message.model ? ` · ${message.model}` : ""}
            </Badge>
          ) : null}
          {!isUser && message.contextUsed ? (
            <Badge variant="outline" className="gap-1 text-[10px]">
              <BarChart3 className="size-3" /> {message.contextUsed.orgName} · {message.contextUsed.projectCount} projects
            </Badge>
          ) : null}
        </div>

        <div
          className={cn(
            "prose prose-sm mt-1 max-w-none break-words dark:prose-invert",
            isUser ? "whitespace-pre-wrap text-[14px] leading-6" : "text-[14px] leading-6"
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          ) : (
            <Markdown className="break-words">{message.content}</Markdown>
          )}
        </div>

        {/* Proposed actions — require confirmation */}
        {!isUser && message.proposedActions && message.proposedActions.length > 0 ? (
          <div className="mt-3 space-y-3">
            {message.proposedActions.map((pa) => {
              const state = actionStates[pa.id] ?? { status: "pending" };
              // eslint-disable-next-line react-hooks/purity
              const isExpired = new Date(pa.expiresAt).getTime() < Date.now() || state.status === "expired";
              const isPending = state.status === "pending";
              const isApproving = state.status === "approving";
              const isRejecting = state.status === "rejecting";
              const isExecuted = state.status === "executed";
              const isRejected = state.status === "rejected";
              const isError = state.status === "error";
              const args = pa.args as Record<string, unknown>;
              const title = getStringArg(args, "title");
              const description = getStringArg(args, "description");
              const priority = getStringArg(args, "priority");
              const status = getStringArg(args, "status");
              const dueDate = getStringArg(args, "dueDate");
              const assigneeId = getStringArg(args, "assigneeId");
              const taskId = getStringArg(args, "taskId");
              const parentTaskId = getStringArg(args, "parentTaskId");
              const subtasks = getSubtasks(args);

              return (
                <div
                  key={pa.id}
                  className={cn(
                    "rounded-lg border p-3 text-sm",
                    isPending && "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20",
                    isExecuted && "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20",
                    isRejected && "border-muted bg-muted/30",
                    isExpired && "border-destructive/30 bg-destructive/5",
                    isError && "border-destructive/30 bg-destructive/10"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "flex size-6 items-center justify-center rounded-full",
                          isPending && "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
                          isExecuted && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
                          (isRejected || isExpired) && "bg-muted text-muted-foreground",
                          isError && "bg-destructive/10 text-destructive"
                        )}
                      >
                        {isPending && <Clock className="size-3.5" />}
                        {isExecuted && <Check className="size-3.5" />}
                        {(isRejected || isExpired) && <X className="size-3.5" />}
                        {isError && <AlertCircle className="size-3.5" />}
                        {(isApproving || isRejecting) && <Loader2 className="size-3.5 animate-spin" />}
                      </span>
                      <span className="font-medium">
                        Proposed: {pa.tool} {pa.projectKey ? `in [${pa.projectKey}]` : ""}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {pa.id.slice(-8)}
                      </Badge>
                      {isExpired ? (
                        <Badge variant="destructive" className="text-[10px]">
                          Expired
                        </Badge>
                      ) : isPending ? (
                        <Badge variant="secondary" className="text-[10px] gap-1">
                          <ShieldCheck className="size-3" /> Awaiting approval
                        </Badge>
                      ) : isExecuted ? (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200 text-[10px]">
                          Executed
                        </Badge>
                      ) : isRejected ? (
                        <Badge variant="outline" className="text-[10px]">
                          Rejected
                        </Badge>
                      ) : null}
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      Expires {new Date(pa.expiresAt).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="mt-2 text-[13px] leading-5">
                    <p className="font-medium">{pa.message}</p>
                    <div className="mt-2 grid gap-1 text-xs">
                      {title ? (
                        <div>
                          <span className="text-muted-foreground">Title:</span> {title}
                        </div>
                      ) : null}
                      {description ? (
                        <div>
                          <span className="text-muted-foreground">Description:</span> {description.slice(0, 200)}
                        </div>
                      ) : null}
                      {priority ? (
                        <div>
                          <span className="text-muted-foreground">Priority:</span> {priority}
                        </div>
                      ) : null}
                      {status ? (
                        <div>
                          <span className="text-muted-foreground">Status:</span> {status}
                        </div>
                      ) : null}
                      {dueDate ? (
                        <div>
                          <span className="text-muted-foreground">Due:</span> {dueDate}
                        </div>
                      ) : null}
                      {assigneeId ? (
                        <div>
                          <span className="text-muted-foreground">Assignee:</span> {assigneeId}
                        </div>
                      ) : null}
                      {taskId ? (
                        <div>
                          <span className="text-muted-foreground">Task ID:</span> {taskId}
                        </div>
                      ) : null}
                      {parentTaskId ? (
                        <div>
                          <span className="text-muted-foreground">Parent:</span> {parentTaskId}
                        </div>
                      ) : null}
                      {subtasks.length ? (
                        <div>
                          <span className="text-muted-foreground">Subtasks ({subtasks.length}):</span> {subtasks.map((s) => s.title).join(", ")}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {isError ? (
                    <div className="mt-2 text-xs text-destructive">{state.error ?? "Failed to process action."}</div>
                  ) : null}

                  {state.result?.ok && isExecuted ? (
                    <div className="mt-2 rounded bg-emerald-100/60 p-2 text-xs text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-100">
                      ✅ {state.result.message}
                      {state.result.data ? (
                        <div className="mt-1 break-all text-[11px] opacity-80">{JSON.stringify(state.result.data)}</div>
                      ) : null}
                    </div>
                  ) : null}

                  {isExpired ? (
                    <div className="mt-3 text-xs text-muted-foreground">
                      This action expired. Ask the assistant to propose it again. No changes were made.
                    </div>
                  ) : isPending ? (
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" onClick={() => onConfirm(pa.id)} disabled={isApproving || isRejecting} className="h-8 gap-1">
                        {isApproving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onReject(pa.id)}
                        disabled={isApproving || isRejecting}
                        className="h-8 gap-1"
                      >
                        {isRejecting ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
                        Reject
                      </Button>
                      <span className="ml-2 self-center text-[11px] text-muted-foreground">No mutation until you approve.</span>
                    </div>
                  ) : isRejected ? (
                    <div className="mt-2 text-xs text-muted-foreground">Rejected — no changes made.</div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}

        {/* Legacy executed actions (for backwards compat, now only after confirmation) */}
        {!isUser && message.actions && message.actions.length > 0 ? (
          <div className="mt-3 space-y-2">
            {message.actions.map((a, idx) => (
              <div
                key={`${message.id}-action-${idx}`}
                className={cn(
                  "flex items-start gap-2 rounded-lg border px-3 py-2 text-xs",
                  a.ok
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100"
                    : "border-destructive/30 bg-destructive/10 text-destructive"
                )}
              >
                <span className="mt-0.5">{a.ok ? <Check className="size-3.5" /> : <AlertCircle className="size-3.5" />}</span>
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{a.tool}</span>: {a.message}
                  {a.data ? <div className="mt-1 break-all text-[11px] opacity-80">{JSON.stringify(a.data)}</div> : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {!isUser ? (
          <div className="mt-2 flex flex-wrap items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-muted-foreground"
              onClick={() => onCopy(message.content, message.id)}
              aria-label="Copy response"
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            {message.usageToday !== undefined && message.limitToday !== undefined ? (
              <span className="ml-2 text-[11px] text-muted-foreground tabular-nums">
                {message.usageToday}/{message.limitToday} today
              </span>
            ) : null}
            {message.contextUsed ? (
              <span className="ml-2 text-[11px] text-muted-foreground">
                Facts: {message.contextUsed.taskCounts.open} open · {message.contextUsed.taskCounts.overdue} overdue ·{" "}
                {message.contextUsed.taskCounts.inProgress} in progress
                {message.contextUsed.hasProjectContext ? " · project focused" : ""}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ErrorBanner({
  message,
  onRetry,
  onDismiss,
  orgId,
}: {
  message: string;
  onRetry: () => void;
  onDismiss: () => void;
  orgId: string;
}) {
  const isPlan = message.toLowerCase().includes("plan") || message.toLowerCase().includes("upgrade") || message.toLowerCase().includes("pro");

  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-destructive">Request failed</p>
        <p className="mt-0.5 break-words text-destructive/90">{message}</p>
        {isPlan ? (
          <div className="mt-3">
            <PlanGateCard
              title="AI needs Pro or Business"
              description="Your current plan doesn't include AI requests. Upgrade to Pro to unlock the assistant — usage is metered per member per day and fully isolated per workspace."
              orgId={orgId}
              compact
            />
          </div>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onRetry} className="h-7">
            <RotateCcw className="size-3.5" /> Retry
          </Button>
          <Button size="sm" variant="ghost" onClick={onDismiss} className="h-7">
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}
