"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  Check,
  CircleDollarSign,
  Clock,
  CreditCard,
  Crown,
  FileBarChart,
  FolderKanban,
  HardDrive,
  Info,
  Loader2,
  Lock,
  Minus,
  Sparkles,
  Users,
  Webhook,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { useOrgStore } from "@/lib/org-store";
import { PLAN_LIMITS, PLAN_PRICING, type PlanKey } from "@/lib/constants";
import { cn, formatDateTime } from "@/lib/utils";
import { apiErrorMessage } from "@/components/features/error-handling";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog, ConfirmDialogContent } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import type { InvitationDTO, OrgDTO } from "@/types";

const PLAN_ORDER: PlanKey[] = ["free", "pro", "business"];

const PLAN_LABEL: Record<PlanKey, string> = {
  free: "Free",
  pro: "Pro",
  business: "Business",
};

function fmtMoney(monthly: number | null): string {
  return monthly === null || monthly === 0 ? "Free" : `$${monthly}/month`;
}

function fmtStorage(mb: number | null): string {
  if (mb === null) return "Unlimited";
  return mb >= 1024 ? `${(mb / 1024).toLocaleString()} GB` : `${mb} MB`;
}

function seatText(n: number | null): string {
  return n === null ? "Unlimited" : `${n} seats`;
}

function planRows(plan: PlanKey): { label: string; value: string; included: boolean }[] {
  const l = PLAN_LIMITS[plan];
  return [
    { label: "Team members", value: l.members === null ? "Unlimited members" : `${l.members} members`, included: true },
    { label: "Projects", value: l.projects === null ? "Unlimited projects" : `${l.projects} projects`, included: true },
    { label: "File storage", value: fmtStorage(l.storageMb), included: true },
    { label: "Advanced analytics", value: l.advancedAnalytics ? "Included" : "Not included", included: l.advancedAnalytics },
    { label: "Webhooks", value: l.webhooks > 0 ? `${l.webhooks} endpoints` : "Not included", included: l.webhooks > 0 },
    {
      label: "AI assistant",
      value: l.aiRequestsPerMemberPerDay > 0 ? `${l.aiRequestsPerMemberPerDay} requests / member / day` : "Not included",
      included: l.aiRequestsPerMemberPerDay > 0,
    },
    { label: "Time tracking", value: l.timeTracking ? "Included" : "Not included", included: l.timeTracking },
  ];
}

export default function BillingSettingsPage() {
  const sp = useSearchParams();
  const { activeOrgId, setActiveOrgId } = useOrgStore();
  const requestedOrg = sp.get("org");
  const orgId = requestedOrg ?? activeOrgId;

  React.useEffect(() => {
    if (requestedOrg && requestedOrg !== activeOrgId) setActiveOrgId(requestedOrg);
  }, [requestedOrg, activeOrgId, setActiveOrgId]);

  const orgQuery = useQuery({
    queryKey: qk.orgDetail(orgId ?? "_"),
    queryFn: () => apiFetch<{ organization: OrgDTO }>(`/api/organizations/${orgId}`),
    enabled: Boolean(orgId),
  });
  const org = orgQuery.data?.organization;

  if (!orgId) {
    return (
      <div className="space-y-4 rounded-xl border bg-muted/20 p-6 text-center">
        <CreditCard className="mx-auto size-8 text-muted-foreground" />
        <p className="text-sm font-medium">No workspace selected</p>
        <p className="mx-auto max-w-sm text-[13px] text-muted-foreground">
          Pick a workspace from the switcher in the top bar, then open Billing again.
        </p>
      </div>
    );
  }

  if (orgQuery.isLoading || (org && org.id !== orgId)) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (orgQuery.isError || !org) {
    return (
      <div className="space-y-4 rounded-xl border bg-muted/20 p-6 text-center">
        <AlertTriangle className="mx-auto size-8 text-destructive" />
        <p className="text-sm font-medium">Couldn&apos;t load billing for this workspace</p>
        <p className="mx-auto max-w-sm text-[13px] text-muted-foreground">
          {orgQuery.error instanceof Error ? orgQuery.error.message : "It may have been deleted, or you no longer have access."}
        </p>
        <Button size="sm" variant="outline" onClick={() => orgQuery.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const isOwner = org.myRole === "owner";
  const isManager = isOwner || org.myRole === "admin";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Billing &amp; plan</h1>
          <p className="text-[13px] text-muted-foreground">
            {org.name} · managed by <span className="font-medium capitalize">{org.myRole}</span>
          </p>
        </div>
        <Badge variant={org.plan === "free" ? "muted" : "default"} className="capitalize">
          <Crown className="mr-1 size-3.5" /> {PLAN_LABEL[org.plan]} plan
        </Badge>
      </div>

      <CurrentPlanCard org={org} />
      <PlanPickerCard org={org} isOwner={isOwner} />
      <UsageCard org={org} canSeePendingInvites={isManager} isOwner={isOwner} />
      <BillingNotesCard org={org} isOwner={isOwner} />
      {isOwner ? <CancelPlanCard org={org} /> : null}
      {!isOwner ? (
        <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <Lock className="size-4 shrink-0" />
          Only the workspace owner can upgrade, downgrade or cancel the plan. Your current plan is shown for reference.
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------- Current plan ----------------------------- */

function CurrentPlanCard({ org }: { org: OrgDTO }) {
  const pricing = PLAN_PRICING[org.plan];
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <BadgeCheck className="size-4 text-muted-foreground" /> Current plan
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={org.name} size="lg" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">{PLAN_LABEL[org.plan]}</h2>
              <Badge variant="secondary">Active</Badge>
              {org.plan === "free" ? <Badge variant="muted">Free forever</Badge> : null}
            </div>
            <p className="text-[13px] text-muted-foreground">
              {fmtMoney(pricing.monthly)} · {pricing.tagline}
            </p>
          </div>
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-x-6 gap-y-1 text-[13px] sm:text-right">
          <span className="text-muted-foreground">Plan status</span>
          <span className="font-medium">Active</span>
          <span className="text-muted-foreground">Seats included</span>
          <span className="font-medium">{seatText(PLAN_LIMITS[org.plan].members)}</span>
          <span className="text-muted-foreground">Storage</span>
          <span className="font-medium">{fmtStorage(PLAN_LIMITS[org.plan].storageMb)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

/* --------------------------- Plan picker ---------------------------- */

function PlanPickerCard({ org, isOwner }: { org: OrgDTO; isOwner: boolean }) {
  const qc = useQueryClient();
  const [pendingPlan, setPendingPlan] = React.useState<PlanKey | null>(null);
  const [mutating, setMutating] = React.useState<PlanKey | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: qk.orgDetail(org.id) });
    qc.invalidateQueries({ queryKey: qk.orgList });
  };

  const change = useMutation({
    mutationFn: (plan: PlanKey) =>
      apiFetch(`/api/organizations/${org.id}/plan`, { method: "PATCH", body: JSON.stringify({ plan }) }),
    onSuccess: () => {
      toast.success(`Plan updated to ${PLAN_LABEL[pendingPlan ?? org.plan]}`);
      setPendingPlan(null);
      invalidate();
    },
    onError: (e) => {
      toast.error(apiErrorMessage(e, "Couldn't change the plan."));
      setPendingPlan(null);
    },
    onSettled: () => setMutating(null),
  });

  const choose = (plan: PlanKey) => {
    if (!isOwner || plan === org.plan || mutating) return;
    setPendingPlan(plan);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Sparkles className="size-4 text-muted-foreground" /> Plans
        </CardTitle>
        <CardDescription>
          {isOwner
            ? "Choose a plan for this workspace. Changes apply immediately."
            : "Compare plans — only the workspace owner can change the plan."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-3">
          {PLAN_ORDER.map((plan) => {
            const pricing = PLAN_PRICING[plan];
            const current = org.plan === plan;
            const selected = pendingPlan === plan;
            const busy = mutating === plan;
            const disabled = !isOwner || current || busy;
            return (
              <button
                key={plan}
                type="button"
                disabled={disabled}
                aria-pressed={current || selected}
                aria-label={
                  current
                    ? `${PLAN_LABEL[plan]} is your current plan`
                    : isOwner
                      ? `Switch to ${PLAN_LABEL[plan]}`
                      : `${PLAN_LABEL[plan]} (owner only)`
                }
                onClick={() => choose(plan)}
                className={cn(
                  "relative flex flex-col rounded-xl border bg-card p-4 text-left outline-none transition-colors",
                  current
                    ? "border-primary/60 ring-1 ring-primary/30"
                    : "hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring",
                  !isOwner && "cursor-not-allowed opacity-90"
                )}
              >
                {current ? (
                  <span className="absolute -top-2.5 right-3 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold tracking-wide text-primary-foreground uppercase">
                    Current
                  </span>
                ) : null}
                <div className="flex items-center gap-2">
                  {plan === "free" ? (
                    <CircleDollarSign className="size-4 text-muted-foreground" />
                  ) : plan === "pro" ? (
                    <Sparkles className="size-4 text-primary" />
                  ) : (
                    <Crown className="size-4 text-amber-500" />
                  )}
                  <h3 className="font-semibold">{PLAN_LABEL[plan]}</h3>
                </div>
                <p className="mt-2 text-xl font-bold">{fmtMoney(pricing.monthly)}</p>
                <p className="text-xs text-muted-foreground">{pricing.tagline}</p>
                <ul className="mt-3 space-y-1.5 text-[13px]">
                  {planRows(plan)
                    .slice(0, 4)
                    .map((row) => (
                      <li key={row.label} className="flex items-start gap-1.5">
                        {row.included ? (
                          <Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden />
                        ) : (
                          <Minus className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
                        )}
                        <span className={row.included ? "" : "text-muted-foreground"}>
                          {row.label}: {row.value}
                        </span>
                      </li>
                    ))}
                </ul>
                <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                  {!isOwner ? (
                    <>
                      <Lock className="size-3" aria-hidden /> Owner only
                    </>
                  ) : current ? (
                    <>
                      <BadgeCheck className="size-3" aria-hidden /> Your current plan
                    </>
                  ) : busy ? (
                    <>
                      <Loader2 className="size-3 animate-spin" aria-hidden /> Updating…
                    </>
                  ) : (
                    <>
                      {pendingPlan === plan ? <Loader2 className="size-3 animate-spin" aria-hidden /> : <Info className="size-3" aria-hidden />}{" "}
                      Click to switch
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 rounded-lg border border-dashed bg-muted/30 p-3 text-[13px] text-muted-foreground">
          <span className="flex items-start gap-2">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              Switching to a smaller plan keeps your workspace intact — extra seats, storage and projects stay put, but new
              invites/uploads past the new limits are blocked until you free up space or upgrade again.
            </span>
          </span>
        </div>

        <ConfirmDialog open={pendingPlan !== null} onOpenChange={(o) => !o && !change.isPending && setPendingPlan(null)}>
          <ConfirmDialogContent
            title={`Switch ${org.name} to ${pendingPlan ? PLAN_LABEL[pendingPlan] : ""}?`}
            description={
              pendingPlan
                ? PLAN_LIMITS[pendingPlan].members !== null &&
                  (org.memberCount > PLAN_LIMITS[pendingPlan].members ||
                    (pendingPlan === "free" && org.plan !== "free"))
                  ? `Your workspace currently has ${org.memberCount} active member${
                      org.memberCount === 1 ? "" : "s"
                    }. ${PLAN_LABEL[pendingPlan]} includes ${PLAN_LIMITS[pendingPlan].members} seats — existing members keep access, but new invites may be limited.`
                  : `You'll be moved to the ${PLAN_LABEL[pendingPlan]} plan (${fmtMoney(PLAN_PRICING[pendingPlan].monthly)}). ${PLAN_LABEL[pendingPlan]} limits and features apply immediately.`
                : undefined
            }
            confirmLabel={
              pendingPlan && PLAN_PRICING[pendingPlan].monthly !== null && PLAN_PRICING[pendingPlan].monthly !== 0
                ? `Switch to ${PLAN_LABEL[pendingPlan]}`
                : `Switch to ${PLAN_LABEL[pendingPlan ?? org.plan]}`
            }
            loading={change.isPending}
            onConfirm={() => {
              if (pendingPlan) {
                setMutating(pendingPlan);
                change.mutate(pendingPlan);
              } else {
                setPendingPlan(null);
              }
            }}
          />
        </ConfirmDialog>
      </CardContent>
    </Card>
  );
}

/* ------------------------------ Usage ------------------------------- */

function UsageCard({
  org,
  canSeePendingInvites,
}: {
  org: OrgDTO;
  canSeePendingInvites: boolean;
  isOwner: boolean;
}) {
  const pendingQuery = useQuery({
    queryKey: qk.invitations(org.id),
    queryFn: () => apiFetch<{ invitations: InvitationDTO[] }>(`/api/organizations/${org.id}/invitations`),
    enabled: canSeePendingInvites,
  });

  const pending = canSeePendingInvites
    ? (pendingQuery.data?.invitations ?? []).filter((i) => i.status === "pending").length
    : 0;
  const limit = PLAN_LIMITS[org.plan].members;
  const used = org.memberCount + (limit === null ? 0 : pending);
  const pct = limit === null ? 0 : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  const remaining = limit === null ? null : Math.max(limit - used, 0);
  const atLimit = limit !== null && used >= limit;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Users className="size-4 text-muted-foreground" /> Usage &amp; limits
        </CardTitle>
        <CardDescription>Current usage against your {PLAN_LABEL[org.plan]} plan.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-[13px]">
            <span className="font-medium">
              Seats — {org.memberCount} active member{org.memberCount === 1 ? "" : "s"}
              {limit !== null ? ` of ${limit}` : " (unlimited)"}
              {pending > 0 ? ` · ${pending} pending invite${pending === 1 ? "" : "s"}` : ""}
            </span>
            <span className="text-muted-foreground">
              {remaining === null ? "unlimited" : `${remaining} remaining`}
            </span>
          </div>
          <div
            role="meter"
            aria-valuemin={0}
            aria-valuemax={limit ?? 1}
            aria-valuenow={Math.min(used, limit ?? used)}
            aria-label="Seat usage"
            className="h-2 w-full overflow-hidden rounded-full bg-muted"
          >
            <div
              className={cn("h-full rounded-full transition-all", atLimit ? "bg-destructive" : "bg-primary")}
              style={{ width: `${limit === null ? 0 : pct}%` }}
            />
          </div>
          {atLimit ? (
            <p className="mt-1.5 flex items-start gap-1.5 text-[13px] text-destructive">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              Seat limit reached — new invitations are blocked until you remove members, or upgrade to a plan with more seats.
            </p>
          ) : remaining !== null && remaining <= 2 ? (
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              You&apos;re close to your seat limit. Remove inactive members or upgrade for more room.
            </p>
          ) : null}
        </div>

        <div className="grid gap-x-6 gap-y-2 rounded-lg border bg-muted/20 p-3 text-[13px] sm:grid-cols-2">
          {planRows(org.plan).map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                {row.label === "Team members" ? (
                  <Users className="size-3.5" />
                ) : row.label === "Projects" ? (
                  <FolderKanban className="size-3.5" />
                ) : row.label === "File storage" ? (
                  <HardDrive className="size-3.5" />
                ) : row.label === "Advanced analytics" ? (
                  <FileBarChart className="size-3.5" />
                ) : row.label === "Webhooks" ? (
                  <Webhook className="size-3.5" />
                ) : row.label === "AI assistant" ? (
                  <Sparkles className="size-3.5" />
                ) : (
                  <Clock className="size-3.5" />
                )}
                {row.label}
              </span>
              <span className={cn("font-medium", !row.included && "text-muted-foreground")}>{row.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* --------------------------- Billing notes -------------------------- */

function BillingNotesCard({ org, isOwner }: { org: OrgDTO; isOwner: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <CreditCard className="size-4 text-muted-foreground" /> Billing account
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-[13px] text-muted-foreground">
        <div className="flex items-center justify-between gap-3">
          <span>Workspace</span>
          <span className="flex items-center gap-2 font-medium text-foreground">
            <Building2 className="size-4" /> {org.name}
            <span className="font-mono text-xs">({org.slug})</span>
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Created</span>
          <span className="font-medium text-foreground">{formatDateTime(org.createdAt)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Plan management</span>
          <span className="font-medium text-foreground">{isOwner ? "Owner" : "Owner only"}</span>
        </div>
        <p className="rounded-lg border border-dashed bg-muted/30 p-2.5 leading-relaxed">
          Plan changes in this workspace apply immediately and don&apos;t require a payment method or card. Canceling keeps the
          workspace and your data — you simply move to the Free plan with its limits.
        </p>
      </CardContent>
    </Card>
  );
}

/* --------------------------- Cancel plan ---------------------------- */

function CancelPlanCard({ org }: { org: OrgDTO }) {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const isPaid = org.plan !== "free";

  const cancel = useMutation({
    mutationFn: () => apiFetch(`/api/organizations/${org.id}/plan`, { method: "DELETE" }),
    onSuccess: () => {
      setOpen(false);
      toast.success("Plan canceled — your workspace is now on the Free plan");
      qc.invalidateQueries({ queryKey: qk.orgDetail(org.id) });
      qc.invalidateQueries({ queryKey: qk.orgList });
    },
    onError: (e) => {
      toast.error(apiErrorMessage(e, "Couldn't cancel the plan."));
      setOpen(false);
    },
  });

  return (
    <Card className="border-destructive/40">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm text-destructive">
          <AlertTriangle className="size-4" /> Cancel plan
        </CardTitle>
        <CardDescription>
          {isPaid
            ? "Cancel moves this workspace to the Free plan. Your data stays; Pro/Business limits will apply."
            : "Your workspace is already on the Free plan — nothing to cancel."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          variant="destructive"
          size="sm"
          disabled={!isPaid}
          onClick={() => setOpen(true)}
          aria-disabled={!isPaid}
        >
          <X className="size-4" /> Cancel {PLAN_LABEL[org.plan]} plan
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          Paid seats, extra storage and paid features (analytics, webhooks, AI) stop applying as soon as the plan is canceled.
        </p>

        <ConfirmDialog open={open} onOpenChange={setOpen}>
          <ConfirmDialogContent
            title="Cancel your paid plan?"
            description={`${org.name} will move to the Free plan: ${PLAN_LIMITS.free.members} seats, ${PLAN_LIMITS.free.projects} projects, ${fmtStorage(
              PLAN_LIMITS.free.storageMb
            )} storage. Existing members keep access; paid features like advanced analytics, webhooks and the AI assistant will be turned off.`}
            confirmLabel="Cancel paid plan"
            destructive
            loading={cancel.isPending}
            onConfirm={() => cancel.mutate()}
          />
        </ConfirmDialog>
      </CardContent>
    </Card>
  );
}
