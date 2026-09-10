import { cn } from "@/lib/utils";
import {
  Activity,
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  FolderKanban,
  Home,
  ListChecks,
  MessagesSquare,
  Search,
  Send,
  Settings,
  Zap,
} from "lucide-react";

/**
 * Static, illustrative product-UI previews for the marketing site.
 * Rendered entirely from design tokens — no live data, no client JS.
 * Each export is honest labeled "Illustrative product interface" where shown.
 */

const STATUS = {
  backlog: "#94a3b8",
  todo: "#38bdf8",
  in_progress: "#8b5cf6",
  in_review: "#f59e0b",
  done: "#22c55e",
} as const;

const PRIORITY = {
  low: "#38bdf8",
  medium: "#f59e0b",
  high: "#f97316",
  urgent: "#ef4444",
} as const;

function Dot({ color }: { color: string }) {
  return <span aria-hidden className="mt-[3px] size-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />;
}

function Chip({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium sm:text-[10px]"
      style={{ backgroundColor: `${color}1f`, color }}
    >
      <Dot color={color} />
      {children}
    </span>
  );
}

function Initials({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-secondary text-[8px] font-semibold text-secondary-foreground sm:text-[9px]",
        className ?? "size-4 sm:size-5"
      )}
    >
      {name}
    </span>
  );
}

function AppFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-background shadow-2xl shadow-black/10 ring-1 ring-black/5 dark:shadow-black/40",
        className
      )}
    >
      {children}
    </div>
  );
}

const NAV_ICONS = [
  { icon: Home, label: "Dashboard" },
  { icon: FolderKanban, label: "Projects" },
  { icon: ListChecks, label: "My tasks" },
  { icon: CalendarDays, label: "Calendar" },
  { icon: MessagesSquare, label: "Chat" },
  { icon: BarChart3, label: "Analytics" },
  { icon: Activity, label: "Activity" },
  { icon: Settings, label: "Settings" },
];

/** Sidebar chrome shared by previews — echoes the real app sidebar. */
function MiniSidebar({ className }: { className?: string }) {
  return (
    <aside
      aria-hidden
      className={cn(
        "flex w-36 shrink-0 flex-col bg-sidebar text-sidebar-foreground sm:w-40",
        className
      )}
    >
      <div className="flex h-9 items-center gap-1.5 border-b border-white/5 px-3">
        <span className="flex size-4 items-center justify-center rounded bg-primary text-[8px] font-extrabold text-primary-foreground">
          N
        </span>
        <span className="text-[10px] font-bold tracking-tight text-white">nexora</span>
      </div>
      <div className="flex-1 space-y-0.5 px-2 py-2">
        {NAV_ICONS.map((item, i) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className={cn(
                "flex items-center gap-1.5 rounded px-1.5 py-1 text-[9px] sm:text-[10px]",
                i === 0 ? "bg-white/10 font-medium text-white" : "text-sidebar-foreground/60"
              )}
            >
              <Icon className="size-3 shrink-0" aria-hidden />
              <span className="truncate">{item.label}</span>
            </div>
          );
        })}
      </div>
      <div className="border-t border-white/5 p-2">
        <div className="flex items-center gap-1.5 rounded bg-white/5 px-1.5 py-1.5">
          <Initials name="AK" />
          <div className="min-w-0">
            <p className="truncate text-[8px] font-medium text-white sm:text-[9px]">Alex Kim</p>
            <p className="truncate text-[7px] text-sidebar-foreground/50 sm:text-[8px]">Owner</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

export function DashboardPreview({ className }: { className?: string }) {
  return (
    <AppFrame className={cn("flex", className)}>
      <MiniSidebar className="hidden sm:flex" />
      <div className="min-w-0 flex-1">
        <div className="flex h-9 items-center gap-2 border-b bg-card px-2.5 sm:px-3">
          <div className="flex h-5 min-w-0 flex-1 items-center gap-1.5 rounded-md border bg-muted/40 px-2 text-[9px] text-muted-foreground sm:max-w-56 sm:text-[10px]">
            <Search className="size-3 shrink-0" aria-hidden />
            <span className="truncate">Search tasks, comments…</span>
          </div>
          <Bell className="size-3 text-muted-foreground" aria-hidden />
          <div className="flex -space-x-1">
            <Initials name="AK" />
            <Initials name="JM" />
            <Initials name="SR" />
          </div>
        </div>
        <div className="space-y-2 p-2.5 sm:p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold sm:text-xs">Product launch</p>
              <p className="text-[8px] text-muted-foreground sm:text-[9px]">Project · 6 members · 24 open tasks</p>
            </div>
            <Chip color={STATUS.in_progress}>In progress</Chip>
          </div>

          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            {[
              { label: "To do", value: "8", color: STATUS.todo },
              { label: "In progress", value: "5", color: STATUS.in_progress },
              { label: "Done", value: "12", color: STATUS.done },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border bg-card p-1.5 sm:p-2">
                <p className="flex items-center gap-1 text-[8px] text-muted-foreground sm:text-[9px]">
                  <Dot color={s.color} /> {s.label}
                </p>
                <p className="mt-0.5 text-xs font-bold tabular-nums sm:text-sm">{s.value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-1.5 sm:grid-cols-2 sm:gap-2">
            <div className="rounded-lg border bg-card p-2 sm:p-2.5">
              <p className="mb-1.5 flex items-center justify-between text-[8px] font-medium text-muted-foreground sm:text-[9px]">
                <span>Sprint progress</span>
                <span className="tabular-nums">68%</span>
              </p>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: "68%" }} />
              </div>
              <div className="mt-2 space-y-1">
                {[
                  { t: "Empty states & error copy", s: "done" },
                  { t: "Rate-limit retry UX", s: "in_progress" },
                  { t: "Onboarding polish", s: "todo" },
                ].map((row) => (
                  <div key={row.t} className="flex items-center gap-1.5">
                    {row.s === "done" ? (
                      <CheckCircle2 className="size-2.5 shrink-0 text-success" aria-hidden />
                    ) : (
                      <Dot color={STATUS[row.s as "in_progress" | "todo"]} />
                    )}
                    <span className="truncate text-[8px] text-foreground/85 sm:text-[9px]">{row.t}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border bg-card p-2 sm:p-2.5">
              <p className="mb-1.5 flex items-center gap-1 text-[8px] font-medium text-muted-foreground sm:text-[9px]">
                <Activity className="size-2.5" aria-hidden /> Recent activity
              </p>
              <ul className="space-y-1.5">
                {[
                  { who: "AK", text: "moved “Launch checklist” to Done", when: "2m" },
                  { who: "JM", text: "commented on “Release notes”", when: "18m" },
                  { who: "SR", text: "created sprint “Sprint 12”", when: "1h" },
                ].map((a) => (
                  <li key={a.text} className="flex items-start gap-1.5">
                    <Initials name={a.who} />
                    <span className="min-w-0 flex-1 text-[8px] leading-snug text-foreground/80 sm:text-[9px]">
                      <span className="font-medium">{a.who}</span> {a.text}
                    </span>
                    <span className="shrink-0 text-[7px] text-muted-foreground sm:text-[8px]">{a.when}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </AppFrame>
  );
}

const BOARD_COLUMNS = [
  {
    key: "todo",
    label: "To Do",
    color: STATUS.todo,
    tasks: [
      { t: "Migrate board queries", p: "medium", a: "AK" },
      { t: "Keyboard shortcuts", p: null, a: "JM" },
    ],
  },
  {
    key: "in_progress",
    label: "In Progress",
    color: STATUS.in_progress,
    tasks: [
      { t: "Comment mentions", p: "high", a: "SR" },
      { t: "Sprint burndown", p: null, a: "AK" },
    ],
  },
  {
    key: "done",
    label: "Done",
    color: STATUS.done,
    tasks: [
      { t: "Webhook retries", p: null, a: "JM" },
      { t: "Tenant isolation tests", p: "urgent", a: "SR" },
    ],
  },
];

export function BoardPreview({ className }: { className?: string }) {
  return (
    <AppFrame className={cn("flex", className)}>
      <MiniSidebar className="hidden sm:flex" />
      <div className="min-w-0 flex-1 bg-muted/20 p-2 sm:p-2.5">
        <div className="mb-1.5 flex items-center justify-between px-0.5">
          <div>
            <p className="text-[10px] font-semibold sm:text-xs">Kanban board</p>
            <p className="text-[8px] text-muted-foreground sm:text-[9px]">Drag tasks between columns</p>
          </div>
          <div className="flex gap-1">
            <Chip color="#8b5cf6">12 open</Chip>
            <Chip color={STATUS.done}>7 done</Chip>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          {BOARD_COLUMNS.map((col) => (
            <div key={col.key} className="rounded-lg border bg-card/60 p-1.5 sm:p-2">
              <div className="mb-1.5 flex items-center justify-between px-0.5">
                <span className="flex items-center gap-1 text-[8px] font-medium text-foreground/80 sm:text-[9px]">
                  <Dot color={col.color} /> {col.label}
                </span>
                <span className="text-[8px] tabular-nums text-muted-foreground">{col.tasks.length}</span>
              </div>
              <div className="space-y-1 sm:space-y-1.5">
                {col.tasks.map((task) => (
                  <div key={task.t} className="rounded-md border bg-card p-1.5 shadow-xs sm:p-2">
                    <p className="text-[8px] font-medium leading-snug text-foreground sm:text-[9px]">{task.t}</p>
                    <div className="mt-1 flex items-center justify-between">
                      {task.p ? (
                        <span
                          className="flex items-center gap-1 text-[7px] font-medium sm:text-[8px]"
                          style={{ color: PRIORITY[task.p as keyof typeof PRIORITY] }}
                        >
                          <Dot color={PRIORITY[task.p as keyof typeof PRIORITY]} />
                          {task.p}
                        </span>
                      ) : (
                        <span />
                      )}
                      <Initials name={task.a} className="size-3.5 sm:size-4" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppFrame>
  );
}

export function SprintPreview({ className }: { className?: string }) {
  return (
    <AppFrame className={cn("flex", className)}>
      <MiniSidebar className="hidden sm:flex" />
      <div className="min-w-0 flex-1 space-y-2 p-2.5 sm:p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold sm:text-xs">Sprint 12 · Launch readiness</p>
            <p className="text-[8px] text-muted-foreground sm:text-[9px]">Sep 1 – Sep 14 · 6 of 9 committed done</p>
          </div>
          <Chip color={STATUS.in_progress}>Active</Chip>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full" style={{ width: "66%", backgroundColor: STATUS.in_progress }} />
        </div>
        <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
          <div className="rounded-lg border bg-card p-2">
            <p className="mb-1.5 flex items-center gap-1 text-[8px] font-medium text-muted-foreground sm:text-[9px]">
              <CheckCircle2 className="size-2.5 text-success" aria-hidden /> Milestones
            </p>
            <ul className="space-y-1">
              {[
                { m: "Public marketing site", d: "Sep 9", done: true },
                { m: "Webhook delivery UI", d: "Sep 12", done: false },
                { m: "Launch checklist", d: "Sep 14", done: false },
              ].map((mi) => (
                <li key={mi.m} className="flex items-center gap-1.5 text-[8px] sm:text-[9px]">
                  {mi.done ? (
                    <Check className="size-2.5 shrink-0 text-success" aria-hidden />
                  ) : (
                    <Dot color={STATUS.in_review} />
                  )}
                  <span className={cn("truncate", mi.done ? "text-muted-foreground line-through" : "")}>{mi.m}</span>
                  <span className="ml-auto shrink-0 text-[7px] text-muted-foreground sm:text-[8px]">{mi.d}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border bg-card p-2">
            <p className="mb-1.5 flex items-center gap-1 text-[8px] font-medium text-muted-foreground sm:text-[9px]">
              <CalendarDays className="size-2.5" aria-hidden /> Calendar
            </p>
            <div className="grid grid-cols-7 gap-0.5 text-center text-[6px] text-muted-foreground sm:text-[7px]">
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                <span key={i} className="py-0.5 font-medium">
                  {d}
                </span>
              ))}
              {Array.from({ length: 14 }).map((_, i) => {
                const day = i + 1;
                const busy = day === 3 || day === 8 || day === 9 || day === 12;
                const today = day === 9;
                return (
                  <span
                    key={i}
                    className={cn(
                      "flex items-center justify-center rounded py-0.5 tabular-nums",
                      today
                        ? "bg-primary font-bold text-primary-foreground"
                        : busy
                          ? "bg-primary/10 font-medium text-primary"
                          : ""
                    )}
                  >
                    {day}
                  </span>
                );
              })}
            </div>
            <div className="mt-1.5 space-y-0.5 text-[7px] text-muted-foreground sm:text-[8px]">
              <p className="flex items-center gap-1">
                <Dot color="#8b5cf6" /> Sprint ceremonies & due dates
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppFrame>
  );
}

export function ChatPreview({ className }: { className?: string }) {
  return (
    <AppFrame className={cn("flex", className)}>
      <div className="hidden w-32 shrink-0 flex-col border-r bg-muted/30 sm:flex lg:w-40">
        <div className="flex h-9 items-center border-b px-2.5 text-[9px] font-semibold sm:text-[10px]">Chat</div>
        <div className="flex-1 space-y-0.5 p-1.5">
          {[
            { name: "# product-launch", active: true, unread: 0 },
            { name: "# design-review", active: false, unread: 3 },
            { name: "Alex Kim", active: false, unread: 0 },
            { name: "Maya S.", active: false, unread: 0 },
          ].map((c) => (
            <div
              key={c.name}
              className={cn(
                "flex items-center justify-between gap-1 rounded px-1.5 py-1 text-[8px] sm:text-[9px]",
                c.active ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground"
              )}
            >
              <span className="truncate">{c.name}</span>
              {c.unread ? (
                <span className="flex size-3 items-center justify-center rounded-full bg-primary text-[6px] font-bold text-primary-foreground">
                  {c.unread}
                </span>
              ) : null}
            </div>
          ))}
        </div>
        <div className="border-t p-2 text-[8px] text-muted-foreground sm:text-[9px]">
          <span className="flex items-center gap-1.5">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex size-1.5 rounded-full bg-success" />
            </span>
            4 online in this workspace
          </span>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-9 items-center justify-between border-b px-2.5">
          <p className="text-[9px] font-semibold sm:text-[10px]"># product-launch</p>
          <span className="flex items-center gap-1 text-[8px] text-muted-foreground sm:text-[9px]">
            <MessagesSquare className="size-2.5" aria-hidden /> Project channel
          </span>
        </div>
        <div className="flex-1 space-y-2 p-2.5">
          <div className="flex items-start gap-1.5">
            <Initials name="AK" />
            <div className="min-w-0">
              <p className="text-[8px] font-medium sm:text-[9px]">
                Alex Kim <span className="font-normal text-muted-foreground">· 09:41</span>
              </p>
              <p className="rounded-lg rounded-tl-sm border bg-card px-2 py-1 text-[8px] leading-relaxed sm:text-[9px]">
                Board polish is merged — mentions now resolve from anywhere in the org.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-1.5">
            <Initials name="SR" />
            <div className="min-w-0">
              <p className="text-[8px] font-medium sm:text-[9px]">
                Sam Rivera <span className="font-normal text-muted-foreground">· 09:43</span>
              </p>
              <p className="rounded-lg rounded-tl-sm border bg-card px-2 py-1 text-[8px] leading-relaxed sm:text-[9px]">
                Nice. <span className="rounded bg-primary/10 px-1 font-medium text-primary">@Alex</span> — can you
                wire the webhook preview into the same panel?
              </p>
              <div className="mt-1 flex gap-1">
                <span className="rounded-full border bg-muted/50 px-1.5 py-0.5 text-[7px] sm:text-[8px]">🚀 3</span>
                <span className="rounded-full border bg-muted/50 px-1.5 py-0.5 text-[7px] sm:text-[8px]">+1 2</span>
              </div>
            </div>
          </div>
          <div className="flex items-start gap-1.5 opacity-80">
            <Initials name="JM" />
            <div className="min-w-0">
              <p className="text-[8px] font-medium sm:text-[9px]">
                Jo Meyer <span className="font-normal text-muted-foreground">· typing…</span>
              </p>
              <div className="flex gap-0.5 py-1.5">
                <span className="size-1 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
                <span className="size-1 animate-bounce rounded-full bg-muted-foreground [animation-delay:120ms]" />
                <span className="size-1 animate-bounce rounded-full bg-muted-foreground [animation-delay:240ms]" />
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 border-t p-2">
          <div className="flex h-6 flex-1 items-center rounded-md border bg-muted/40 px-2 text-[8px] text-muted-foreground sm:text-[9px]">
            Message # product-launch
          </div>
          <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Send className="size-2.5" aria-hidden />
          </span>
        </div>
      </div>
    </AppFrame>
  );
}

const BARS = [34, 52, 41, 66, 58, 74, 62];

export function AnalyticsPreview({ className }: { className?: string }) {
  return (
    <AppFrame className={cn("flex", className)}>
      <MiniSidebar className="hidden sm:flex" />
      <div className="min-w-0 flex-1 space-y-2 p-2.5 sm:p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold sm:text-xs">Analytics · Last 7 days</p>
            <p className="text-[8px] text-muted-foreground sm:text-[9px]">Task velocity and workload by member</p>
          </div>
          <div className="hidden gap-1 sm:flex">
            <Chip color={STATUS.done}>Trends</Chip>
            <Chip color="#8b5cf6">Distributions</Chip>
          </div>
        </div>
        <div className="grid gap-1.5 sm:grid-cols-3 sm:gap-2">
          <div className="rounded-lg border bg-card p-2 sm:col-span-2">
            <p className="mb-2 text-[8px] font-medium text-muted-foreground sm:text-[9px]">
              Tasks completed per day
            </p>
            <div className="flex h-20 items-end gap-1.5 sm:h-24 sm:gap-2">
              {BARS.map((h, i) => (
                <div key={i} className="group flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t-sm bg-primary/80 transition-colors group-hover:bg-primary"
                    style={{ height: `${h}%` }}
                  />
                  <span className="text-[6px] text-muted-foreground sm:text-[7px]">
                    {["M", "T", "W", "T", "F", "S", "S"][i]}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border bg-card p-2">
            <p className="mb-2 text-[8px] font-medium text-muted-foreground sm:text-[9px]">Workload by member</p>
            <ul className="space-y-1.5">
              {[
                { who: "AK", pct: 72, color: STATUS.in_progress },
                { who: "JM", pct: 48, color: STATUS.todo },
                { who: "SR", pct: 91, color: "#8b5cf6" },
              ].map((w) => (
                <li key={w.who} className="flex items-center gap-1.5">
                  <Initials name={w.who} />
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${w.pct}%`, backgroundColor: w.color }} />
                  </div>
                  <span className="text-[7px] tabular-nums text-muted-foreground sm:text-[8px]">{w.pct}%</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[7px] text-muted-foreground sm:text-[8px]">
              Reassign or rebalance directly from the workload chart.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          {[
            { label: "Avg. cycle time", value: "3.2d", trend: "-0.4d" },
            { label: "Tasks completed", value: "26", trend: "+12%" },
            { label: "Time tracked", value: "94h", trend: "+8%" },
          ].map((k) => (
            <div key={k.label} className="rounded-lg border bg-card p-2">
              <p className="text-[7px] text-muted-foreground sm:text-[8px]">{k.label}</p>
              <p className="text-xs font-bold tabular-nums sm:text-sm">{k.value}</p>
              <p className="text-[7px] font-medium text-success sm:text-[8px]">{k.trend}</p>
            </div>
          ))}
        </div>
      </div>
    </AppFrame>
  );
}

const DELIVERIES = [
  { evt: "task.updated", code: 200, ms: 12 },
  { evt: "comment.created", code: 200, ms: 9 },
  { evt: "task.created", code: 200, ms: 11 },
  { evt: "member.added", code: 200, ms: 8 },
];

export function WebhookPreview({ className }: { className?: string }) {
  return (
    <AppFrame className={cn("flex", className)}>
      <div className="min-w-0 flex-1 space-y-2 p-2.5 sm:p-3">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <div>
            <p className="text-[10px] font-semibold sm:text-xs">Webhook endpoints</p>
            <p className="text-[8px] text-muted-foreground sm:text-[9px]">Signed, retryable HTTP callbacks for workspace events</p>
          </div>
          <Chip color={STATUS.done}>HMAC-SHA256</Chip>
        </div>

        <div className="space-y-1">
          {["https://api.example.dev/hooks/nexora", "https://hooks.example.dev/prod"].map((url, i) => (
            <div key={url} className="flex items-center gap-2 rounded-lg border bg-card px-2 py-1.5 sm:px-2.5">
              <span className="rounded bg-primary/10 px-1 py-0.5 text-[7px] font-bold text-primary sm:text-[8px]">POST</span>
              <span className="min-w-0 flex-1 truncate font-mono text-[8px] text-foreground/85 sm:text-[9px]">{url}</span>
              {i === 0 ? <Chip color={STATUS.done}>Active</Chip> : <Chip color={STATUS.in_review}>Paused</Chip>}
            </div>
          ))}
        </div>

        <div className="rounded-lg border bg-card">
          <div className="flex h-7 items-center justify-between border-b px-2">
            <span className="flex items-center gap-1.5 text-[8px] font-medium text-muted-foreground sm:text-[9px]">
              <Zap className="size-2.5" aria-hidden /> Recent deliveries
            </span>
            <span className="text-[7px] text-muted-foreground sm:text-[8px]">Retry · 3 attempts</span>
          </div>
          <ul className="divide-y divide-border/60">
            {DELIVERIES.map((d) => (
              <li key={d.evt} className="flex items-center gap-2 px-2 py-1 text-[8px] sm:text-[9px]">
                <span className="w-28 truncate font-mono text-primary sm:w-32">{d.evt}</span>
                <span className="flex items-center gap-1 font-medium text-success">
                  <Check className="size-2.5" aria-hidden /> {d.code}
                </span>
                <span className="ml-auto tabular-nums text-muted-foreground">{d.ms}ms</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg bg-sidebar p-2 font-mono text-[7px] leading-relaxed text-sidebar-foreground sm:text-[8px]">
          <p>
            <span className="text-success">$</span> curl -X POST https://api.nexora.example/webhooks \
          </p>
          <p> -H &quot;X-Nexora-Signature: t=1757410000,sha256=9f86d08…&quot;</p>
        </div>
      </div>
      <aside
        aria-hidden
        className="hidden w-32 shrink-0 flex-col border-l bg-muted/30 p-2 lg:flex lg:w-36"
      >
        <p className="text-[8px] font-semibold text-muted-foreground sm:text-[9px]">Events</p>
        <ul className="mt-1.5 space-y-1 text-[8px] text-foreground/80 sm:text-[9px]">
          {["task.*", "comment.*", "project.*", "sprint.updated", "member.*", "file.*"].map((e) => (
            <li key={e} className="font-mono">
              {e}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[7px] leading-relaxed text-muted-foreground sm:text-[8px]">
          Secrets are shown once at creation and verified by signature on every delivery.
        </p>
      </aside>
    </AppFrame>
  );
}
