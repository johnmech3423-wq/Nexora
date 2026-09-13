import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Bell,
  CalendarDays,
  Clock3,
  FolderKanban,
  KeyRound,
  LayoutGrid,
  MessagesSquare,
  Radio,
  Search,
  ShieldCheck,
  Users,
  Webhook,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  AnalyticsPreview,
  BoardPreview,
  ChatPreview,
  DashboardPreview,
  SprintPreview,
  WebhookPreview,
} from "@/components/marketing/product-previews";

export const metadata: Metadata = {
  title: "Nexora — the workspace for planning, execution, and improvement",
  description:
    "Nexora is a production-grade multi-tenant project workspace: projects, boards, tasks, sprints, chat, analytics and webhooks in one place, with role-based access and secure sessions.",
  openGraph: {
    title: "Nexora — plan, execute, track, improve",
    description:
      "A working multi-tenant SaaS workspace: projects, kanban, sprints, chat, analytics and webhooks — built on Next.js.",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Nexora — multi-tenant project workspace" }],
  },
  alternates: { canonical: "/" },
};

const REGISTER = "/register?next=%2Fdashboard";
const LOGIN = "/login?next=%2Fdashboard";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-xs">
      <span className="size-1.5 rounded-full bg-success" aria-hidden />
      {children}
    </p>
  );
}

function SectionHeading({
  kicker,
  title,
  body,
  center = false,
}: {
  kicker: string;
  title: string;
  body?: string;
  center?: boolean;
}) {
  return (
    <div className={cn("max-w-2xl", center && "mx-auto text-center")}>
      <p className="text-sm font-semibold tracking-wide text-primary">{kicker}</p>
      <h2 className="mt-2 text-3xl font-bold tracking-tight text-balance sm:text-4xl">{title}</h2>
      {body ? <p className="mt-4 text-base leading-relaxed text-muted-foreground text-pretty">{body}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Trust strip — only real, architecture-level capabilities           */
/* ------------------------------------------------------------------ */

const TRUST = [
  { icon: Users, text: "Multi-tenant workspaces with org-scoped isolation" },
  { icon: ShieldCheck, text: "Owner → guest role model, enforced server-side" },
  { icon: KeyRound, text: "Secure sessions, 2FA and session inventory" },
  { icon: Radio, text: "Realtime event bus with pluggable transport" },
  { icon: Webhook, text: "HMAC-signed webhooks and a REST API" },
  { icon: LayoutGrid, text: "Vercel-ready: static marketing, API routes" },
] as const;

function TrustStrip() {
  return (
    <section aria-label="Platform capabilities" className="border-y bg-muted/30">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <ul className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {TRUST.map((t) => (
            <li key={t.text} className="flex items-start gap-3 text-sm text-foreground/85">
              <t.icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              {t.text}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Feature grid (bento) — every item maps to a real Nexora capability  */
/* ------------------------------------------------------------------ */

const FEATURES = [
  {
    icon: FolderKanban,
    title: "Projects & kanban",
    body: "Projects with custom statuses and labels, drag-and-drop boards, archived & private projects.",
    href: "/features#projects",
  },
  {
    icon: LayoutGrid,
    title: "Tasks with depth",
    body: "Subtasks, priorities, due dates, estimates, assignees, watchers and full-text search.",
    href: "/features#tasks",
  },
  {
    icon: CalendarDays,
    title: "Sprints & milestones",
    body: "Plan iterations, track milestone due dates, and see everything on a shared team calendar.",
    href: "/features#planning",
  },
  {
    icon: MessagesSquare,
    title: "Chat & comments",
    body: "Direct messages, groups and project channels — with mentions, replies, reactions and presence.",
    href: "/features#collaboration",
  },
  {
    icon: Bell,
    title: "Notifications",
    body: "Mentions, assignments, comments and deadlines routed to a personal notification center.",
    href: "/features#collaboration",
  },
  {
    icon: Clock3,
    title: "Time tracking",
    body: "Running timer or manual entries per task, with daily caps and project rollups.",
    href: "/features#productivity",
  },
  {
    icon: BarChart3,
    title: "Analytics & activity",
    body: "Trends, task distributions, per-member workload, and a complete org activity log.",
    href: "/features#visibility",
  },
  {
    icon: Search,
    title: "Org-wide search",
    body: "One search box across projects, tasks, comments and chat messages.",
    href: "/features#visibility",
  },
] as const;

function FeatureGrid() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:px-8 sm:py-24">
      <SectionHeading
        center
        kicker="Capabilities"
        title="Everything a working team needs, in one workspace"
        body="Nexora isn't a mockup: each capability below maps to a real feature in the running application."
      />
      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <Link
            key={f.title}
            href={f.href}
            className="group flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-xs outline-none transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground" aria-hidden>
              <f.icon className="size-4.5" />
            </span>
            <span>
              <h3 className="font-semibold tracking-tight">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </span>
            <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              See in features <ArrowRight className="size-3.5" aria-hidden />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Showcase sections (alternating)                                     */
/* ------------------------------------------------------------------ */

interface Showcase {
  kicker: string;
  title: string;
  body: string;
  bullets: { title: string; text: string }[];
  visual: React.ReactNode;
  visualLabel: string;
}

const SHOWCASES: Showcase[] = [
  {
    kicker: "Plan",
    title: "Shape the work before it starts",
    body: "Projects carry custom statuses and labels; work is grouped into sprints with milestones and due dates, and everything lands on a shared calendar so the plan is visible to the whole team.",
    bullets: [
      { title: "Sprints", text: "Plan, start and complete iterations with progress tracking." },
      { title: "Milestones", text: "Date-bound goals per project, with status rollups." },
      { title: "Calendar", text: "Tasks, sprints and deadlines on one team-wide timeline." },
    ],
    visual: <SprintPreview />,
    visualLabel: "Planning view — sprints, milestones and calendar",
  },
  {
    kicker: "Execute",
    title: "Move work the way your team thinks",
    body: "Kanban boards with drag-and-drop columns keep execution honest. Tasks carry priorities, subtasks, estimates, assignees and due dates, so the board is never just a list of names.",
    bullets: [
      { title: "Boards & statuses", text: "Backlog → To do → In progress → In review → Done, or your own." },
      { title: "Task depth", text: "Subtasks, priorities, watchers, estimates and attachments." },
      { title: "Time tracking", text: "Start a timer from any task and roll the day up." },
    ],
    visual: <BoardPreview />,
    visualLabel: "Kanban board — sample project with real statuses",
  },
  {
    kicker: "Collaborate",
    title: "Discuss work where the work lives",
    body: "Comments on tasks support replies, mentions and reactions; chat covers direct messages, groups and per-project channels with typing and presence events. Notifications collect it all per person.",
    bullets: [
      { title: "Mentions", text: "Address anyone in the workspace — they get notified." },
      { title: "Reactions & replies", text: "Threaded comments and message reactions everywhere." },
      { title: "Presence", text: "Who's online and typing, scoped to your organization." },
    ],
    visual: <ChatPreview />,
    visualLabel: "Team chat — project channel with reactions and presence",
  },
  {
    kicker: "Measure",
    title: "Know whether the plan is working",
    body: "Analytics compute task trends and distributions from real project data; workload view shows how much is assigned to each member; the activity log records what changed, when, and by whom.",
    bullets: [
      { title: "Trends", text: "Completed tasks over time, filtered by project and status." },
      { title: "Workload", text: "Per-member load to rebalance before it hurts." },
      { title: "Activity log", text: "An auditable stream of org-wide changes." },
    ],
    visual: <AnalyticsPreview />,
    visualLabel: "Analytics — trends, distributions and workload (sample data)",
  },
  {
    kicker: "Automate",
    title: "Let other systems follow along",
    body: "Webhook endpoints receive signed, retryable deliveries for task, comment, project, sprint and membership events. Every mutation also flows through a typed REST API with server-side rate limits.",
    bullets: [
      { title: "HMAC signatures", text: "Every delivery carries X-Nexora-Signature verification." },
      { title: "Retries & delivery log", text: "Failed deliveries retry with an inspectable history." },
      { title: "Typed API", text: "Consistent JSON envelopes, validation and error codes." },
    ],
    visual: <WebhookPreview />,
    visualLabel: "Webhooks — signed deliveries and recent events",
  },
];

function ShowcaseSection({ item, flip }: { item: Showcase; flip: boolean }) {
  return (
    <section className="border-t bg-muted/20">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-14 lg:px-8 sm:py-20">
        <div className={cn(flip && "lg:order-2")}>
          <p className="text-sm font-semibold tracking-wide text-primary">{item.kicker}</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-balance sm:text-3xl">{item.title}</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground text-pretty">{item.body}</p>
          <ul className="mt-6 space-y-4">
            {item.bullets.map((b) => (
              <li key={b.title} className="flex gap-3">
                <span
                  className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                  aria-hidden
                >
                  <ArrowRight className="size-3 rotate-45" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold">{b.title}</h3>
                  <p className="text-sm text-muted-foreground">{b.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className={cn("relative", flip && "lg:order-1")}>
          <div
            aria-hidden
            className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-primary/10 via-transparent to-transparent blur-2xl"
          />
          <div className="relative">{item.visual}</div>
          <p className="mt-3 text-center text-xs text-muted-foreground">{item.visualLabel}</p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function MarketingHomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(60%_60%_at_50%_0%,hsl(var(--primary)/0.12),transparent)]"
        />
        <div className="mx-auto w-full max-w-6xl px-4 pt-16 pb-14 sm:px-6 sm:pt-20 sm:pb-16 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Eyebrow>Working SaaS — every feature on this page is live in the product</Eyebrow>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Plan, execute, track &amp; improve your team&apos;s work
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground text-pretty sm:text-lg">
              Nexora is a production-grade, multi-tenant workspace: projects, kanban boards, sprints, chat, analytics and
              webhooks share one architecture — with role-based access and secure sessions enforced server-side.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href={REGISTER} className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}>
                Create your workspace <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link href={LOGIN} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full sm:w-auto")}>
                Log in
              </Link>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              <Link
                href="/features"
                className="font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              >
                Explore the features
              </Link>{" "}
              — or read the{" "}
              <Link
                href="/about"
                className="font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              >
                engineering story
              </Link>
              .
            </p>
          </div>

          <div className="relative mx-auto mt-14 max-w-5xl">
            <div
              aria-hidden
              className="absolute -inset-8 -z-10 rounded-[2.5rem] bg-[radial-gradient(50%_50%_at_50%_45%,hsl(var(--primary)/0.16),transparent)] blur-2xl"
            />
            <DashboardPreview />
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Illustrative product interface — rendered with the actual Nexora design system and sample content.
            </p>
          </div>
        </div>
      </section>

      <TrustStrip />

      <FeatureGrid />

      {SHOWCASES.map((item, i) => (
        <ShowcaseSection key={item.kicker} item={item} flip={i % 2 === 1} />
      ))}

      {/* Final CTA */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:px-8 sm:py-24">
        <div className="relative overflow-hidden rounded-2xl border bg-card px-6 py-14 text-center shadow-sm sm:px-12 sm:py-16">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_0%,hsl(var(--primary)/0.14),transparent)]"
          />
          <div className="relative mx-auto max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              Give it a spin — the workspace is live
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Create an account, start a workspace, and in a few minutes you&apos;ll have a project, a board, a sprint and
              a chat channel running. Free tier: 5 members, 3 projects, sprints included.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href={REGISTER} className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}>
                Get started free <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link href="/pricing" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full sm:w-auto")}>
                See plans
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
