"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  FolderKanban,
  Loader2,
  Lock,
  MailPlus,
  Rocket,
  Send,
  ShieldCheck,
  Users,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { useMe } from "@/lib/hooks/use-session";
import { useOrgStore } from "@/lib/org-store";
import { ORG_ROLE_LABELS, type OrgRole } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { apiErrorMessage } from "@/components/features/error-handling";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/controls";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import type { InvitationDTO, OrgDTO, ProjectSummaryDTO } from "@/types";

/* ------------------------------ Helpers ----------------------------- */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function slugHint(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "workspace"
  );
}

function keyHint(name: string): string {
  const letters = name.replace(/[^a-zA-Z]/g, "").toUpperCase();
  return (letters.slice(0, 2) || "PR").slice(0, 8);
}

function parseEmails(raw: string): string[] {
  return [...new Set(raw.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))];
}

const orgSchema = z.object({
  name: z.string().trim().min(2, "Give your workspace a name (at least 2 characters).").max(80, "Keep the name under 80 characters."),
  description: z.string().trim().max(400, "Keep the description under 400 characters.").optional(),
});
type OrgValues = z.infer<typeof orgSchema>;

const projectSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(120, "Keep the name under 120 characters."),
  key: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, "Key must be at least 2 characters.")
    .max(8, "Key must be under 8 characters.")
    .regex(/^[A-Z][A-Z0-9]*$/, "Letters and numbers only, starting with a letter."),
  description: z.string().trim().max(4000).optional(),
});
type ProjectValues = z.infer<typeof projectSchema>;

const INVITE_ROLES: OrgRole[] = ["admin", "member", "guest"];

/* ----------------------------- Page state --------------------------- */

type FlowStep = 0 | 1 | 2 | 3; // welcome, workspace, team, project
type Screen = "loading" | "signed-out" | "welcome" | "picker" | "flow" | "done";

interface CreatedState {
  org: OrgDTO | null;
  project: ProjectSummaryDTO | null;
  inviteCount: number;
  inviteSkipped: string[];
  inviteRole: OrgRole;
}

const EMPTY_CREATED: CreatedState = {
  org: null,
  project: null,
  inviteCount: 0,
  inviteSkipped: [],
  inviteRole: "member",
};

export default function OnboardingPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const me = useMe();
  // Server-verified organization list (OrgDTO shape) — source of truth for first-run state.
  const orgsQ = useQuery({
    queryKey: qk.orgList,
    queryFn: () => apiFetch<{ organizations: OrgDTO[] }>("/api/organizations"),
    staleTime: 30_000,
  });
  const { setActiveOrgId } = useOrgStore();

  // Flow flags are changed only by user events; the effective screen is derived
  // from real backend state (session + organization list) on every render.
  const [flowActive, setFlowActive] = React.useState(false);
  const [finished, setFinished] = React.useState(false);
  const [step, setStep] = React.useState<FlowStep>(0);
  const [created, setCreated] = React.useState<CreatedState>(EMPTY_CREATED);

  const orgs = orgsQ.data?.organizations ?? [];

  // Session state always wins (expired sessions must not keep a stale flow open).
  let screen: Screen;
  if (me.isError || !me.data) screen = "signed-out";
  else if (finished) screen = "done";
  else if (flowActive) screen = "flow";
  else if (me.isLoading || orgsQ.isLoading) screen = "loading";
  else screen = orgs.length > 0 ? "picker" : "welcome";

  const signOut = useMutation({
    mutationFn: () => apiFetch("/api/auth/logout", { method: "POST" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.me });
      setFlowActive(false);
      setFinished(false);
      setCreated(EMPTY_CREATED);
    },
    onError: () => toast.error("Couldn't sign out — try again."),
  });

  const openOrg = (orgId: string) => {
    setActiveOrgId(orgId);
    router.push("/dashboard");
  };

  return (
    <main className="flex min-h-dvh flex-col bg-muted/25">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 pt-6 pb-2 sm:px-6">
        <span className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground" aria-hidden>
            <Building2 className="size-4" />
          </span>
          Nexora
        </span>
        {me.data ? (
          <button
            type="button"
            onClick={() => signOut.mutate()}
            disabled={signOut.isPending}
            className="rounded-md px-2 py-1 text-[13px] text-muted-foreground underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            {signOut.isPending ? "Signing out…" : "Sign out"}
          </button>
        ) : null}
      </header>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-4 sm:px-6">
        {screen === "loading" ? <LoadingState /> : null}
        {screen === "signed-out" ? <SignedOutState /> : null}
        {screen === "picker" ? (
          <PickerScreen
            orgs={orgs}
            onOpen={openOrg}
            onStartNew={() => {
              setCreated(EMPTY_CREATED);
              setStep(0);
              setFlowActive(true);
            }}
          />
        ) : null}
        {screen === "welcome" ? (
          <WelcomeScreen
            canSkip={orgs.length > 0}
            onContinue={() => {
              setStep(0);
              setFlowActive(true);
            }}
            onSkip={() => openOrg(orgs[0].id)}
          />
        ) : null}
        {screen === "flow" ? (
          <FlowShell
            step={step}
            onBack={() => setStep((s) => (s > 0 ? ((s - 1) as FlowStep) : s))}
            created={created}
            setCreated={setCreated}
            existingOrgs={orgs}
            onDone={() => setFinished(true)}
            onOpenOrg={openOrg}
            onGoTo={(st) => setStep(st)}
          />
        ) : null}
        {screen === "done" ? (
          <DoneScreen
            created={created}
            onGoToWorkspace={() => {
              if (created.org) {
                setActiveOrgId(created.org.id);
                router.push("/dashboard");
              } else {
                router.push("/dashboard");
              }
            }}
          />
        ) : null}
      </div>

      <footer className="mx-auto w-full max-w-2xl px-4 pb-6 text-center text-xs text-muted-foreground">
        {me.data ? <span>Signed in as {me.data.user.email}</span> : <span>Nexora — plan, track and ship together.</span>}
      </footer>
    </main>
  );
}

/* ---------------------------- Sub screens --------------------------- */

function LoadingState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 py-16" aria-busy>
      <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Loader2 className="size-6 animate-spin" aria-hidden />
      </span>
      <div className="w-full max-w-sm space-y-3">
        <Skeleton className="mx-auto h-5 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="mx-auto h-4 w-5/6" />
      </div>
    </div>
  );
}

function SignedOutState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted">
        <Lock className="size-5 text-muted-foreground" aria-hidden />
      </span>
      <div>
        <h1 className="text-lg font-semibold">Sign in to get started</h1>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          Onboarding is tied to your Nexora account. If you were invited, open the invitation link from your inbox — accepting
          it adds the workspace to your account automatically.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Link href="/login?next=/onboarding" className={buttonVariants({ size: "default" })}>
          Sign in
        </Link>
        <Link href="/register" className={buttonVariants({ variant: "outline", size: "default" })}>
          Create account
        </Link>
      </div>
      <p className="text-xs text-muted-foreground">
        Sessions expire — if this page appeared after a pause, sign in again to continue.
      </p>
    </div>
  );
}

function WelcomeScreen({ canSkip, onContinue, onSkip }: { canSkip: boolean; onContinue: () => void; onSkip: () => void }) {
  const bullets = [
    { icon: FolderKanban, title: "Projects & boards", body: "Organize work with boards, sprints, milestones and priorities." },
    { icon: Users, title: "A team that's in sync", body: "Chat, comments, mentions and notifications keep everyone aligned." },
    { icon: Rocket, title: "Ship with momentum", body: "Analytics, time tracking and automations help you improve as you go." },
  ];
  return (
    <div className="flex flex-1 flex-col justify-center gap-8 py-10 sm:py-14">
      <div className="text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20" aria-hidden>
          <Building2 className="size-7" />
        </span>
        <h1 className="mt-5 text-3xl font-bold tracking-tight">Welcome to Nexora</h1>
        <p className="mx-auto mt-2 max-w-md text-[15px] text-muted-foreground">
          Your workspace for planning projects, tracking tasks and shipping together. Let&apos;s set yours up in about a minute.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {bullets.map((b) => (
          <div key={b.title} className="rounded-xl border bg-card p-4 text-center sm:text-left">
            <b.icon className="mx-auto mb-2 size-5 text-primary sm:mx-0" aria-hidden />
            <p className="text-sm font-medium">{b.title}</p>
            <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{b.body}</p>
          </div>
        ))}
      </div>
      <div className="mx-auto w-full max-w-sm space-y-2.5">
        <Button size="lg" className="w-full" onClick={onContinue}>
          Get started <ArrowRight className="size-4" />
        </Button>
        {canSkip ? (
          <Button variant="ghost" className="w-full" onClick={onSkip}>
            Enter my existing workspace
          </Button>
        ) : null}
        <p className="text-center text-xs text-muted-foreground">
          Were you invited? Use the link from your invitation email — accepted workspaces appear in your account automatically.
        </p>
      </div>
    </div>
  );
}

function PickerScreen({ orgs, onOpen, onStartNew }: { orgs: OrgDTO[]; onOpen: (id: string) => void; onStartNew: () => void }) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-6 py-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">Pick a workspace to continue — or create a new one.</p>
      </div>
      <div className="space-y-2">
        {orgs.map((org) => (
          <button
            key={org.id}
            type="button"
            onClick={() => onOpen(org.id)}
            className="group flex w-full items-center gap-3 rounded-xl border bg-card p-3.5 text-left outline-none transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Avatar name={org.name} size="md" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{org.name}</span>
              <span className="block text-xs text-muted-foreground">
                {org.memberCount} member{org.memberCount === 1 ? "" : "s"} · <span className="capitalize">{org.plan}</span> ·{" "}
                <span className="font-medium capitalize">{org.myRole}</span>
              </span>
            </span>
            <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <Button variant="outline" onClick={onStartNew}>
        <span aria-hidden className="mr-1.5 text-base leading-none">+</span> Create another workspace
      </Button>
    </div>
  );
}

/* ------------------------------- Flow ------------------------------- */

const FLOW_STEPS: { label: string }[] = [{ label: "Workspace" }, { label: "Team" }, { label: "Project" }];

function FlowShell({
  step,
  onBack,
  created,
  setCreated,
  existingOrgs,
  onDone,
  onOpenOrg,
  onGoTo,
}: {
  step: FlowStep;
  onBack: () => void;
  created: CreatedState;
  setCreated: React.Dispatch<React.SetStateAction<CreatedState>>;
  existingOrgs: OrgDTO[];
  onDone: () => void;
  onOpenOrg: (orgId: string) => void;
  onGoTo: (s: FlowStep) => void;
}) {
  const flowStepIndex = step === 0 ? 0 : step - 1;
  const hasExisting = existingOrgs.length > 0;

  return (
    <div className="flex flex-1 flex-col justify-center py-6">
      {step >= 1 ? (
        <>
          <div className="mb-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              aria-label="Back"
              className="rounded-md p-1.5 text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft className="size-4" />
            </button>
            <p className="text-sm font-medium">
              Step {flowStepIndex + 1} of {FLOW_STEPS.length}
            </p>
          </div>
          <ol className="mb-6 flex items-center gap-1.5" aria-label="Onboarding progress">
            {FLOW_STEPS.map((s, i) => {
              const done = i < flowStepIndex;
              const current = i === flowStepIndex;
              return (
                <li key={s.label} className="flex flex-1 items-center gap-1.5">
                  <span
                    aria-current={current ? "step" : undefined}
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      done
                        ? "bg-primary text-primary-foreground"
                        : current
                          ? "bg-primary/15 text-primary ring-1 ring-primary/40"
                          : "bg-muted text-muted-foreground"
                    )}
                  >
                    {done ? <Check className="size-3.5" aria-hidden /> : i + 1}
                  </span>
                  <span className={cn("hidden text-xs font-medium sm:block", current ? "text-foreground" : "text-muted-foreground")}>
                    {s.label}
                  </span>
                  {i < FLOW_STEPS.length - 1 ? <span className="h-px flex-1 bg-border" aria-hidden /> : null}
                </li>
              );
            })}
          </ol>
        </>
      ) : null}

      {step === 0 ? (
        <WorkspaceStep
          hasExisting={hasExisting}
          onCreated={(org) => {
            setCreated((c) => ({ ...c, org }));
            onGoTo(1);
          }}
          onFinishLater={() => onOpenOrg(existingOrgs[0].id)}
        />
      ) : null}
      {step === 1 && created.org ? (
        <TeamStep
          org={created.org}
          role={created.inviteRole}
          onRoleChange={(r) => setCreated((c) => ({ ...c, inviteRole: r }))}
          onSent={(sent, skipped) => setCreated((c) => ({ ...c, inviteCount: c.inviteCount + sent, inviteSkipped: [...c.inviteSkipped, ...skipped] }))}
          onNext={() => onGoTo(2)}
          onBack={onBack}
        />
      ) : null}
      {step === 2 && created.org ? (
        <ProjectStep
          org={created.org}
          onCreated={(p) => {
            setCreated((c) => ({ ...c, project: p }));
            onDone();
          }}
          onSkip={() => onDone()}
          onBack={onBack}
        />
      ) : null}
    </div>
  );
}

/* -------------------------- Workspace step -------------------------- */

function WorkspaceStep({
  hasExisting,
  onCreated,
  onFinishLater,
}: {
  hasExisting: boolean;
  onCreated: (org: OrgDTO) => void;
  onFinishLater: () => void;
}) {
  const qc = useQueryClient();
  const { setOptions, setActiveOrgId } = useOrgStore();

  const form = useForm<OrgValues>({
    resolver: zodResolver(orgSchema),
    defaultValues: { name: "", description: "" },
  });
  const [nameDraft, setNameDraft] = React.useState("");

  const create = useMutation({
    mutationFn: (values: OrgValues) =>
      apiFetch<{ organization: OrgDTO }>("/api/organizations", {
        method: "POST",
        body: JSON.stringify({
          name: values.name,
          ...(values.description ? { description: values.description } : {}),
        }),
      }),
    onSuccess: async (data) => {
      const org = data.organization;
      // Refresh org list from the server and activate the new tenant (no stale state).
      const fresh = await qc.fetchQuery({
        queryKey: qk.orgList,
        queryFn: () => apiFetch<{ organizations: OrgDTO[] }>("/api/organizations"),
      });
      setOptions(fresh.organizations);
      setActiveOrgId(org.id);
      toast.success(`Workspace “${org.name}” created`);
      onCreated(org);
    },
    onError: (e) => toast.error(apiErrorMessage(e, "Couldn't create the workspace.")),
  });

  return (
    <div>
      <div className="text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden>
          <Building2 className="size-5" />
        </span>
        <h2 className="mt-3 text-xl font-bold">Create your workspace</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          Workspaces hold your projects, tasks and team. You can always create more later.
        </p>
      </div>

      <form
        onSubmit={form.handleSubmit((v) => create.mutate(v))}
        className="mx-auto mt-6 w-full max-w-sm space-y-4"
        noValidate
        aria-busy={create.isPending}
      >
        <div className="space-y-1.5">
          <Label htmlFor="onb-org-name">Workspace name</Label>
          <Input
            id="onb-org-name"
            autoFocus
            placeholder="e.g. Acme Inc."
            maxLength={80}
            {...form.register("name", {
              onChange: (e) => setNameDraft((e.target as HTMLInputElement).value),
            })}
          />
          {form.formState.errors.name ? (
            <p className="text-xs text-destructive" role="alert">{form.formState.errors.name.message}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              URL will look like <span className="font-mono">nexora.app/{slugHint(nameDraft)}</span>
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="onb-org-desc">
            Description <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea id="onb-org-desc" rows={2} maxLength={400} placeholder="What does your team do?" {...form.register("description")} />
        </div>

        {create.isError ? (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-2.5 text-[13px] text-destructive" role="alert">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{apiErrorMessage(create.error, "Couldn't create the workspace.")}</span>
          </div>
        ) : null}

        <div className="space-y-2.5 pt-1">
          <Button type="submit" size="lg" className="w-full" disabled={create.isPending}>
            {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Create workspace
          </Button>
          {hasExisting ? (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={onFinishLater}
                className="rounded px-1 py-0.5 text-xs text-muted-foreground underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              >
                Finish later — go to my existing workspace
              </button>
            </div>
          ) : null}
        </div>
      </form>
    </div>
  );
}

/* ----------------------------- Team step ---------------------------- */

function TeamStep({
  org,
  role,
  onRoleChange,
  onSent,
  onNext,
  onBack,
}: {
  org: OrgDTO;
  role: OrgRole;
  onRoleChange: (r: OrgRole) => void;
  onSent: (sent: number, skipped: string[]) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [emailsRaw, setEmailsRaw] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [clientError, setClientError] = React.useState<string | null>(null);

  const emails = parseEmails(emailsRaw);

  const send = useMutation({
    mutationFn: () => {
      if (emails.length === 0) {
        setClientError("Add at least one email address.");
        throw new Error("empty");
      }
      const invalid = emails.filter((e) => !EMAIL_RE.test(e));
      if (invalid.length > 0) {
        setClientError(`Invalid email address: ${invalid.join(", ")}`);
        throw new Error("invalid");
      }
      if (emails.length > 20) {
        setClientError("You can invite up to 20 people at once.");
        throw new Error("toomany");
      }
      setClientError(null);
      return apiFetch<{ invitations: InvitationDTO[]; skippedExisting: string[] }>(`/api/organizations/${org.id}/invitations`, {
        method: "POST",
        body: JSON.stringify({ emails, role, ...(message.trim() ? { message: message.trim() } : {}) }),
      });
    },
    onSuccess: (data) => {
      onSent(data.invitations.length, data.skippedExisting);
      setEmailsRaw("");
      setMessage("");
      toast.success(
        data.invitations.length === 1
          ? `Invitation sent to ${data.invitations[0].email}`
          : `${data.invitations.length} invitation${data.invitations.length === 1 ? "" : "s"} sent`
      );
      if (data.skippedExisting.length > 0) {
        toast.info(`${data.skippedExisting.join(", ")} ${data.skippedExisting.length === 1 ? "is" : "are"} already members or invited`);
      }
    },
    onError: (e) => {
      if (e instanceof Error && ["empty", "invalid", "toomany"].includes(e.message)) return;
      toast.error(apiErrorMessage(e, "Couldn't send the invitation."));
    },
  });

  return (
    <div>
      <div className="text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden>
          <MailPlus className="size-5" />
        </span>
        <h2 className="mt-3 text-xl font-bold">Invite your team</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          Add people to <span className="font-medium text-foreground">{org.name}</span>. Each invite is a personal email link,
          valid for 7 days — or skip and invite later.
        </p>
      </div>

      <div className="mx-auto mt-6 w-full max-w-sm space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="onb-emails">Email addresses</Label>
          <Textarea
            id="onb-emails"
            rows={3}
            autoFocus
            value={emailsRaw}
            onChange={(e) => {
              setEmailsRaw(e.target.value);
              setClientError(null);
            }}
            placeholder={"ada@example.com\nbrian@example.com"}
          />
          <p className="text-xs text-muted-foreground">One per line or comma-separated — up to 20. Existing members and pending invites are skipped.</p>
        </div>
        <div className="space-y-1.5">
          <Label id="onb-role-label">Role</Label>
          <Select value={role} onValueChange={(v) => onRoleChange(v as OrgRole)}>
            <SelectTrigger aria-labelledby="onb-role-label" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INVITE_ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {ORG_ROLE_LABELS[r]} —{" "}
                  {r === "admin" ? "manage projects & members" : r === "member" ? "full workspace access" : "read-mostly access"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {clientError ? <p className="text-[13px] text-destructive" role="alert">{clientError}</p> : null}
        {send.isError ? (
          <p className="text-[13px] text-destructive" role="alert">{apiErrorMessage(send.error, "Couldn't send the invitation.")}</p>
        ) : null}

        <div className="space-y-2 pt-1">
          <Button size="lg" className="w-full" disabled={send.isPending || emails.length === 0} onClick={() => send.mutate()}>
            {send.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Send invitation{emails.length > 1 ? `s (${emails.length})` : ""}
          </Button>
          <div className="flex items-center justify-between text-xs">
            <button type="button" onClick={onBack} className="rounded p-1 text-muted-foreground underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring">
              <ArrowLeft className="mr-1 inline size-3.5" aria-hidden /> Back
            </button>
            <button type="button" onClick={onNext} className="rounded p-1 font-medium text-primary underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
              Skip, invite later <ArrowRight className="ml-1 inline size-3.5" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- Project step -------------------------- */

function ProjectStep({
  org,
  onCreated,
  onSkip,
  onBack,
}: {
  org: OrgDTO;
  onCreated: (p: ProjectSummaryDTO) => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const [privateProject, setPrivateProject] = React.useState(false);
  const lastSuggested = React.useRef("");

  const form = useForm<ProjectValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: { name: "", key: "", description: "" },
  });

  // Auto-suggest the key from the name while the user hasn't touched it.
  const [nameDraft, setNameDraft] = React.useState("");
  const name = nameDraft;
  React.useEffect(() => {
    const current = form.getValues("key");
    if (name.trim() && (!current || current === lastSuggested.current)) {
      const hint = keyHint(name);
      lastSuggested.current = hint;
      form.setValue("key", hint);
    } else if (!name.trim() && current === lastSuggested.current) {
      lastSuggested.current = "";
      form.setValue("key", "");
    }
  }, [name, form]);

  const create = useMutation({
    mutationFn: (values: ProjectValues) =>
      apiFetch<{ project: ProjectSummaryDTO }>(`/api/projects?orgId=${encodeURIComponent(org.id)}`, {
        method: "POST",
        body: JSON.stringify({
          name: values.name,
          key: values.key,
          ...(values.description ? { description: values.description } : {}),
          private: privateProject,
        }),
      }),
    onSuccess: (data) => {
      toast.success(`Project “${data.project.name}” created`);
      onCreated(data.project);
    },
    onError: (e) => toast.error(apiErrorMessage(e, "Couldn't create the project.")),
  });

  return (
    <div>
      <div className="text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden>
          <FolderKanban className="size-5" />
        </span>
        <h2 className="mt-3 text-xl font-bold">Create your first project</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          A project groups tasks on a board in <span className="font-medium text-foreground">{org.name}</span>. Skip this to add
          projects later from the dashboard.
        </p>
      </div>

      <form
        onSubmit={form.handleSubmit((v) => create.mutate(v))}
        className="mx-auto mt-6 w-full max-w-sm space-y-4"
        noValidate
        aria-busy={create.isPending}
      >
        <div className="space-y-1.5">
          <Label htmlFor="onb-proj-name">Project name</Label>
          <Input
            id="onb-proj-name"
            autoFocus
            placeholder="e.g. Website relaunch"
            maxLength={120}
            {...form.register("name", {
              onChange: (e) => setNameDraft((e.target as HTMLInputElement).value),
            })}
          />
          {form.formState.errors.name ? <p className="text-xs text-destructive" role="alert">{form.formState.errors.name.message}</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="onb-proj-key">Project key</Label>
          <Input id="onb-proj-key" placeholder="e.g. WEB" maxLength={8} {...form.register("key")} />
          {form.formState.errors.key ? (
            <p className="text-xs text-destructive" role="alert">{form.formState.errors.key.message}</p>
          ) : (
            <p className="text-xs text-muted-foreground">Short code used in task references — 2 to 8 letters/digits, starts with a letter.</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="onb-proj-desc">
            Description <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea id="onb-proj-desc" rows={2} maxLength={4000} placeholder="What is this project about?" {...form.register("description")} />
        </div>
        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border bg-card p-3 text-sm">
          <Checkbox checked={privateProject} onCheckedChange={(c) => setPrivateProject(c !== false)} className="mt-0.5" />
          <span>
            <span className="font-medium">Private project</span>
            <span className="block text-xs text-muted-foreground">
              Only members you add can see it. Otherwise everyone in the workspace can.
            </span>
          </span>
        </label>

        {create.isError ? (
          <p className="text-[13px] text-destructive" role="alert">{apiErrorMessage(create.error, "Couldn't create the project.")}</p>
        ) : null}

        <div className="space-y-2 pt-1">
          <Button type="submit" size="lg" className="w-full" disabled={create.isPending}>
            {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Create project
          </Button>
          <div className="flex items-center justify-between text-xs">
            <button type="button" onClick={onBack} className="rounded p-1 text-muted-foreground underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring">
              <ArrowLeft className="mr-1 inline size-3.5" aria-hidden /> Back
            </button>
            <button type="button" onClick={onSkip} className="rounded p-1 font-medium text-primary underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
              Skip for now <ArrowRight className="ml-1 inline size-3.5" aria-hidden />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

/* ----------------------------- Done screen -------------------------- */

function DoneScreen({ created, onGoToWorkspace }: { created: CreatedState; onGoToWorkspace: () => void }) {
  const org = created.org;
  if (!org) return null;

  const inviteStatus =
    created.inviteCount > 0
      ? `${created.inviteCount} invitation${created.inviteCount === 1 ? "" : "s"} sent${
          created.inviteSkipped.length ? ` · ${created.inviteSkipped.length} skipped (already members or invited)` : ""
        }`
      : "No invitations sent — add teammates anytime from Members.";

  return (
    <div className="flex flex-1 flex-col justify-center gap-6 py-8">
      <div className="text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-success/15 text-success" aria-hidden>
          <CheckCircle2 className="size-7" />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">You&apos;re all set!</h1>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Here&apos;s what you set up:</p>
      </div>

      <div className="mx-auto w-full max-w-md space-y-2">
        <div className="flex items-center gap-3 rounded-xl border bg-card p-3.5">
          <Avatar name={org.name} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{org.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              Workspace · {org.memberCount} member{org.memberCount === 1 ? "" : "s"} · you&apos;re the owner
            </p>
          </div>
          <Badge variant="secondary" className="capitalize">{org.plan}</Badge>
        </div>

        {created.project ? (
          <div className="flex items-center gap-3 rounded-xl border bg-card p-3.5">
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: (created.project.color ?? "#8b5cf6") + "22" }}
              aria-hidden
            >
              <FolderKanban className="size-4" style={{ color: created.project.color ?? "#8b5cf6" }} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{created.project.name}</p>
              <p className="truncate font-mono text-xs text-muted-foreground">Key {created.project.key}</p>
            </div>
            <Link href={`/projects/${created.project.id}/board`} className="shrink-0 text-xs font-medium text-primary underline-offset-2 hover:underline">
              Open board
            </Link>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed p-3.5 text-[13px] text-muted-foreground">
            <span className="flex items-center gap-2">
              <FolderKanban className="size-4" aria-hidden /> No project yet — create one anytime from the dashboard.
            </span>
          </div>
        )}

        <div className="flex items-start gap-2.5 rounded-xl border bg-card p-3.5 text-[13px] text-muted-foreground">
          <MailPlus className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <span>{inviteStatus}</span>
        </div>
      </div>

      <div className="mx-auto w-full max-w-md space-y-3">
        <Button size="lg" className="w-full" onClick={onGoToWorkspace}>
          Go to workspace <ArrowRight className="size-4" />
        </Button>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <Link href="/dashboard" className="underline-offset-2 hover:text-foreground hover:underline">Dashboard</Link>
          <span aria-hidden>·</span>
          <Link href={`/settings/members?org=${org.id}`} className="underline-offset-2 hover:text-foreground hover:underline">Invite members</Link>
          <span aria-hidden>·</span>
          <Link href={`/settings/general?org=${org.id}`} className="underline-offset-2 hover:text-foreground hover:underline">Workspace settings</Link>
        </div>
        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" aria-hidden /> As owner you can manage roles, plans and members any time.
        </p>
      </div>
    </div>
  );
}
