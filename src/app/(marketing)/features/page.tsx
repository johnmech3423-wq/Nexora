import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  Clock3,
  FileText,
  FolderKanban,
  KeyRound,
  LayoutGrid,
  ListChecks,
  MessagesSquare,
  Radio,
  Search,
  Settings2,
  ShieldCheck,
  Users,
  Webhook,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Features — the full Nexora capability catalog",
  description:
    "Projects, kanban, tasks, sprints, milestones, chat, comments, notifications, time tracking, analytics, roles, guests, webhooks and a typed REST API — every feature Nexora actually ships.",
  alternates: { canonical: "/features" },
};

interface Feature {
  icon: typeof FolderKanban;
  name: string;
  what: string;
  why: string;
}

/* ------------------------------------------------------------------ */
/* Groups                                                              */
/* ------------------------------------------------------------------ */

const GROUPS: {
  id: string;
  kicker: string;
  title: string;
  blurb: string;
  features: Feature[];
}[] = [
  {
    id: "projects",
    kicker: "Project management",
    title: "Projects with structure, not just lists",
    blurb:
      "Each project carries its own key, status workflow and labels; teams customize the columns to match how they actually work.",
    features: [
      {
        icon: FolderKanban,
        name: "Projects",
        what: "Named projects with keys, descriptions, colors, optional start/end dates, private visibility and archiving.",
        why: "Every task, board and channel belongs to a project, so work stays organized and scoped.",
      },
      {
        icon: LayoutGrid,
        name: "Kanban boards",
        what: "Board view with drag-and-drop cards across status columns such as Backlog, To Do, In Progress, In Review and Done.",
        why: "The board is the shared picture of execution — statuses update instantly for the whole team.",
      },
      {
        icon: Settings2,
        name: "Custom workflows",
        what: "Projects can define their own statuses, colors and label definitions.",
        why: "A design team and a support team don't share the same funnel; neither should their columns.",
      },
    ],
  },
  {
    id: "tasks",
    kicker: "Tasks",
    title: "Tasks built for real work",
    blurb: "Subtasks, priorities, dates, estimates and ownership — with comments attached to every task.",
    features: [
      {
        icon: ListChecks,
        name: "Subtasks & hierarchy",
        what: "Tasks can nest under a parent task, mirroring how work decomposes.",
        why: "Big initiatives stay trackable while the granular work gets done.",
      },
      {
        icon: Zap,
        name: "Priorities & dates",
        what: "Priority from Low to Urgent, start/due dates, and time estimates per task.",
        why: "Sequencing and deadline pressure become visible before they become problems.",
      },
      {
        icon: Users,
        name: "Assignment & watchers",
        what: "One assignee plus watchers; assignment and mention events fan out through the activity feed and notifications.",
        why: "Accountability is explicit and nobody is left out of the loop.",
      },
      {
        icon: FileText,
        name: "Comments, mentions & reactions",
        what: "Threaded task comments with @-mentions, reactions, and file attachments.",
        why: "Decisions are recorded next to the work they affect.",
      },
    ],
  },
  {
    id: "planning",
    kicker: "Planning",
    title: "Iterations, milestones, calendar",
    blurb: "Turn the backlog into a plan the whole team can see.",
    features: [
      {
        icon: CalendarDays,
        name: "Sprints",
        what: "Planned, active and completed sprints with per-sprint task assignment and progress rollups.",
        why: "Time-boxed iterations create a rhythm and make delivery measurable.",
      },
      {
        icon: ShieldCheck,
        name: "Milestones",
        what: "Date-bound milestones per project with status tracking.",
        why: "Long projects keep their shape when the checkpoints are explicit.",
      },
      {
        icon: CalendarDays,
        name: "Team calendar",
        what: "A calendar view aggregating tasks, sprints and milestones across the workspace.",
        why: "Deadlines across projects surface in one honest timeline.",
      },
    ],
  },
  {
    id: "collaboration",
    kicker: "Collaboration",
    title: "Discuss work where it lives",
    blurb: "Chat for conversations, comments for decisions, notifications to tie it together.",
    features: [
      {
        icon: MessagesSquare,
        name: "Chat",
        what: "Direct messages, group conversations and per-project channels, with read receipts and unread counts.",
        why: "Project context travels with the channel — no separate tool required.",
      },
      {
        icon: Bell,
        name: "Presence & typing",
        what: "Online status, typing indicators and conversation read state via the org-scoped realtime bus.",
        why: "Team members know who is around without asking.",
      },
      {
        icon: Bell,
        name: "Notifications",
        what: "Personal notification center covering mentions, assignments, comments, invitations and deadline reminders.",
        why: "The system tells you when your attention is needed.",
      },
      {
        icon: Search,
        name: "Global search",
        what: "Full-text search across projects, tasks, comments and chat messages.",
        why: "Tribal knowledge stops being a search problem.",
      },
    ],
  },
  {
    id: "productivity",
    kicker: "Productivity",
    title: "Know where the time goes",
    blurb: "Track time without leaving the task.",
    features: [
      {
        icon: Clock3,
        name: "Time tracking",
        what: "A running timer or manual entries per task, editable with descriptions.",
        why: "Effort data makes estimates and capacity planning honest.",
      },
      {
        icon: Activity,
        name: "Activity history",
        what: "An org-wide activity log of task, comment, project, sprint and membership events.",
        why: "What changed, when, and by whom — without asking around.",
      },
    ],
  },
  {
    id: "visibility",
    kicker: "Visibility",
    title: "Measure the plan",
    blurb: "Analytics computed from real project data — not exported spreadsheets.",
    features: [
      {
        icon: BarChart3,
        name: "Trends & distributions",
        what: "Completed-task trends over time and task distributions by status, project and member.",
        why: "Delivery rate and bottlenecks become visible at a glance.",
      },
      {
        icon: BarChart3,
        name: "Workload",
        what: "Per-member workload charts with assignee-level rollups.",
        why: "Re-balancing happens before someone quietly burns out.",
      },
    ],
  },
  {
    id: "organization",
    kicker: "Organization",
    title: "One product, many workspaces",
    blurb: "Multi-tenancy isn't an afterthought: every query in the API is scoped to an organization.",
    features: [
      {
        icon: Users,
        name: "Workspaces & members",
        what: "Organizations with member management, invitation links (7-day expiry, revocable) and suspended members.",
        why: "People join the workspace, then get access to exactly the projects they need.",
      },
      {
        icon: KeyRound,
        name: "Role-based access",
        what: "Org roles Owner, Admin, Member and Guest plus per-project Manager, Member and Viewer roles.",
        why: "Billing stays with the owner, guests stay read-mostly, and nobody carries keys they don't need.",
      },
      {
        icon: ShieldCheck,
        name: "Tenant isolation",
        what: "Org-scoped data access enforced server-side on every read and mutation.",
        why: "One team can never see another team's projects — even by crafting requests.",
      },
    ],
  },
  {
    id: "platform",
    kicker: "Platform",
    title: "Built for developers to extend",
    blurb: "The product surface is a typed HTTP API; the UI is one of its clients.",
    features: [
      {
        icon: Webhook,
        name: "Webhooks",
        what: "Signed, retryable HTTP deliveries for task, comment, project, sprint and membership events, with pause, rotation and delivery history.",
        why: "CI pipelines, CRMs and bots can react to workspace events without polling.",
      },
      {
        icon: KeyRound,
        name: "Secure sessions",
        what: "httpOnly session cookies with configurable 7/30-day lifetimes, session inventory and one-click revocation.",
        why: "Lost devices are a settings page away from being harmless.",
      },
      {
        icon: Radio,
        name: "Realtime event bus",
        what: "Org- and user-scoped event fan-out with a pluggable transport (no-op locally, Pusher-compatible in production).",
        why: "Mutations stay REST — replay-safe — while updates arrive live when a transport is configured.",
      },
      {
        icon: Zap,
        name: "AI assistant layer",
        what: "An optional chat assistant behind a provider abstraction (OpenAI-compatible endpoints), metered per member per day by plan.",
        why: "The app doesn't hard-code a vendor; teams bring their own endpoint and keys.",
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Role matrix — mirrors src/lib/permissions.ts                        */
/* ------------------------------------------------------------------ */

const ROLES = ["Owner", "Admin", "Member", "Guest"] as const;

const MATRIX: { label: string; value: [boolean, boolean, boolean, boolean] }[] = [
  { label: "Manage billing & plan", value: [true, false, false, false] },
  { label: "Workspace settings", value: [true, true, false, false] },
  { label: "Invite members & manage roles", value: [true, true, false, false] },
  { label: "Remove members", value: [true, true, false, false] },
  { label: "Create projects", value: [true, true, true, false] },
  { label: "Edit, archive & delete projects", value: [true, true, false, false] },
  { label: "Create & edit tasks", value: [true, true, true, false] },
  { label: "Delete any comment", value: [true, true, true, false] },
  { label: "Manage sprints & milestones", value: [true, true, false, false] },
  { label: "Manage webhooks", value: [true, true, false, false] },
  { label: "Use AI assistant", value: [true, true, true, false] },
  { label: "Track time", value: [true, true, true, false] },
  { label: "Read analytics & activity", value: [true, true, true, false] },
  { label: "Calendar & chat (read/send)", value: [true, true, true, true] },
];

function FeatureIcon({ icon: Icon }: { icon: typeof FolderKanban }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground" aria-hidden>
      <Icon className="size-4.5" />
    </span>
  );
}

export default function FeaturesPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8 sm:py-20">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold tracking-wide text-primary">Features</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          Every capability, honestly catalogued
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          This page maps the Nexora feature set as implemented — from project boards to webhook signatures. If it&apos;s
          listed, it&apos;s running in the product.
        </p>
      </div>

      <div className="mt-14 space-y-20">
        {GROUPS.map((group) => (
          <section key={group.id} id={group.id} aria-labelledby={`${group.id}-heading`} className="scroll-mt-24">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold tracking-wide text-primary">{group.kicker}</p>
              <h2 id={`${group.id}-heading`} className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                {group.title}
              </h2>
              <p className="mt-2 text-[15px] text-muted-foreground">{group.blurb}</p>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {group.features.map((f) => (
                <article key={f.name} className="flex flex-col rounded-xl border bg-card p-5 shadow-xs">
                  <div className="flex items-center gap-3">
                    <FeatureIcon icon={f.icon} />
                    <h3 className="font-semibold tracking-tight">{f.name}</h3>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-foreground/85">{f.what}</p>
                  <p className="mt-3 border-t pt-3 text-[13px] leading-relaxed text-muted-foreground">
                    <span className="font-medium text-foreground/70">Why it matters: </span>
                    {f.why}
                  </p>
                </article>
              ))}
            </div>
          </section>
        ))}

        {/* Role matrix */}
        <section id="roles" aria-labelledby="roles-heading" className="scroll-mt-24">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold tracking-wide text-primary">Access control</p>
            <h2 id="roles-heading" className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              Who can do what
            </h2>
            <p className="mt-2 text-[15px] text-muted-foreground">
              Organization-level roles from the permission registry shared by the UI and the server. Guests get a
              deliberately read-mostly view; billing is owner-only.
            </p>
          </div>
          <div className="mt-8 overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[560px] border-collapse bg-card text-sm">
              <caption className="sr-only">Organization role permissions matrix</caption>
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Capability
                  </th>
                  {ROLES.map((r) => (
                    <th key={r} scope="col" className="px-4 py-3 text-center font-semibold">
                      {r}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MATRIX.map((row, i) => (
                  <tr key={row.label} className={cn("border-b last:border-0", i % 2 === 1 && "bg-muted/20")}>
                    <th scope="row" className="px-4 py-2.5 text-left font-normal text-foreground/90">
                      {row.label}
                    </th>
                    {row.value.map((v, j) => (
                      <td key={ROLES[j]} className="px-4 py-2.5 text-center">
                        {v ? (
                          <Check className="mx-auto size-4 text-success" aria-label="Allowed" />
                        ) : (
                          <span aria-label="Not allowed" className="text-muted-foreground/50">
                            —
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Projects add a second layer: Manager, Member and Viewer roles refine access inside each project. Permission
            checks run server-side on every request — the UI only hides what the API would refuse.
          </p>
        </section>

        {/* Developer note */}
        <section id="api" aria-labelledby="api-heading" className="scroll-mt-24">
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold tracking-wide text-primary">For developers</p>
              <h2 id="api-heading" className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                A typed API under everything
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
                Every screen talks to REST routes under <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[13px]">/api</code> that
                validate input with Zod, enforce permissions and rate limits, and answer with a consistent JSON envelope.
                Feature gates return typed error codes the client renders — e.g.{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[13px]">plan_required</code> for a
                restricted feature on the Free plan.
              </p>
              <p className="mt-4">
                <Link href="/security" className={cn(buttonVariants({ variant: "outline" }), "w-full sm:w-auto")}>
                  Read the security architecture
                </Link>
              </p>
            </div>
            <div className="rounded-xl border bg-card p-5 font-mono text-[13px] leading-relaxed shadow-xs">
              <p className="text-muted-foreground"># Permission keys in the shared registry</p>
              <p className="mt-1 text-primary">org.read · project.create · task.assign</p>
              <p className="text-primary">sprint.manage · webhook.manage · billing.manage</p>
              <p className="mt-2 text-muted-foreground"># Webhook events emitted by the server</p>
              <p className="text-primary">task.created · task.updated · comment.created</p>
              <p className="text-primary">project.updated · sprint.updated · member.added</p>
              <p className="mt-2 text-muted-foreground"># Error codes the API can return</p>
              <p className="text-primary">validation_error · unauthorized · forbidden</p>
              <p className="text-primary">not_found · conflict · rate_limited · plan_required</p>
            </div>
          </div>
        </section>
      </div>

      {/* CTA */}
      <section className="mt-20 rounded-2xl border bg-card px-6 py-12 text-center shadow-sm sm:px-12">
        <h2 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">Try every feature on the Free plan</h2>
        <p className="mx-auto mt-3 max-w-xl text-[15px] text-muted-foreground">
          5 members, 3 projects, sprints and the full collaboration stack — no payment details, ever.
        </p>
        <Link
          href="/register?next=%2Fdashboard"
          className={cn(buttonVariants({ size: "lg" }), "mt-7 w-full sm:w-auto")}
        >
          Create your workspace
        </Link>
      </section>
    </div>
  );
}
