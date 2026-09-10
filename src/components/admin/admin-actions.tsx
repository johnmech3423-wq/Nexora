"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { PLANS, PLAN_PRICING, type PlanKey } from "@/lib/constants";
import type { AdminOrgRow, AdminUserRow } from "@/lib/admin-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog, ConfirmDialogContent, ConfirmDialogTrigger } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import { cn } from "@/lib/utils";

/** Maps thrown errors to concise user-facing copy. Never raw internals. */
export function describeError(e: unknown): string {
  if (e instanceof ApiClientError) {
    if (e.code === "server_error" || e.code === "external_unavailable") {
      return "The platform service hit an error. Please try again in a moment.";
    }
    return e.message;
  }
  if (e instanceof TypeError) return "Network error — check your connection and try again.";
  return "Something went wrong. Please try again.";
}

/* ------------------------------------------------------------------ */
/* User suspend / reactivate                                           */
/* ------------------------------------------------------------------ */

function SuspendConfirmContent({
  user,
  suspended,
  onDone,
}: {
  user: AdminUserRow;
  suspended: boolean;
  onDone: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const qc = useQueryClient();

  const run = async () => {
    if (busy) return; // duplicate-submission guard
    setBusy(true);
    try {
      await apiFetch(`/api/admin/users/${encodeURIComponent(user.id)}`, {
        method: "PATCH",
        body: { suspended },
      });
      toast.success(suspended ? `Suspended ${user.name}` : `Reactivated ${user.name}`);
      await qc.invalidateQueries({ queryKey: ["admin", "list", "users"] });
      setOpen(false);
      onDone();
    } catch (e) {
      toast.error(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ConfirmDialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
      <ConfirmDialogTrigger asChild>
        {suspended ? (
          <Button variant="outline" size="sm">
            Reactivate
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
            Suspend
          </Button>
        )}
      </ConfirmDialogTrigger>
      <ConfirmDialogContent
        destructive={!suspended}
        loading={busy}
        title={suspended ? `Reactivate ${user.name}?` : `Suspend ${user.name}?`}
        confirmLabel={suspended ? "Reactivate user" : "Suspend user"}
        description={
          suspended ? (
            <span>
              Reactivation restores the account&apos;s workspace memberships to active status. Existing sessions were
              revoked at suspension time, so the user will sign in again normally.
              <span className="mt-2 block text-xs text-muted-foreground">
                {user.name} · {user.email}
              </span>
            </span>
          ) : (
            <span>
              This is a <strong className="font-semibold">platform-level action</strong>. Suspending immediately revokes
              every active session and marks all of the user&apos;s workspace memberships as suspended — they lose
              access to every organization they belong to. An admin can reactivate the account later.
              <span className="mt-2 block text-xs text-muted-foreground">
                {user.name} · {user.email} · currently in {user.organizationCount}{" "}
                {user.organizationCount === 1 ? "organization" : "organizations"}
              </span>
            </span>
          )
        }
        onConfirm={() => void run()}
      />
    </ConfirmDialog>
  );
}

export function UserRowActions({
  user,
  self,
  onChanged,
}: {
  user: AdminUserRow;
  self?: boolean;
  onChanged: () => void;
}) {
  if (self) {
    return (
      <Badge variant="muted" title="This is the account you are signed in with">
        You (admin)
      </Badge>
    );
  }
  return (
    <SuspendConfirmContent
      key={`${user.id}-${user.suspended}`}
      user={user}
      suspended={user.suspended}
      onDone={onChanged}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Organization plan change                                            */
/* ------------------------------------------------------------------ */

export function OrgPlanAction({ org, onChanged }: { org: AdminOrgRow; onChanged: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const qc = useQueryClient();
  const currentPlan = PLANS.includes(org.plan as PlanKey) ? (org.plan as PlanKey) : "free";
  const [selection, setSelection] = React.useState<PlanKey>(currentPlan);

  const apply = async () => {
    if (busy) return;
    if (selection === currentPlan) {
      setOpen(false);
      return;
    }
    setBusy(true);
    try {
      const data = await apiFetch<{ plan: string }>(`/api/admin/organizations/${encodeURIComponent(org.id)}`, {
        method: "PATCH",
        body: { plan: selection },
      });
      toast.success(`${org.name} is now on the ${data.plan} plan`);
      await qc.invalidateQueries({ queryKey: ["admin", "list", "organizations"] });
      setOpen(false);
      onChanged();
    } catch (e) {
      toast.error(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Change plan</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Change plan — {org.name}</DialogTitle>
          <DialogDescription>
            Sets the plan key enforced by the billing gate for this organization. Current plan:{" "}
            <span className="font-medium text-foreground capitalize">{currentPlan}</span>.
          </DialogDescription>
        </DialogHeader>
        <div role="radiogroup" aria-label="Plan" className="space-y-2">
          {PLANS.map((plan) => {
            const price = PLAN_PRICING[plan];
            return (
              <label
                key={plan}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm outline-none transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                  selection === plan ? "border-primary/60 bg-accent/40" : "hover:bg-muted/50"
                )}
              >
                <input
                  type="radio"
                  name="plan"
                  value={plan}
                  checked={selection === plan}
                  onChange={() => setSelection(plan)}
                  className="size-4 accent-primary"
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium capitalize">{plan}</span>
                  <span className="block text-xs text-muted-foreground">{price.tagline}</span>
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  {price.monthly === 0 ? "$0" : `$${price.monthly}`}
                  <span className="text-xs font-normal text-muted-foreground">/mo</span>
                </span>
              </label>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={busy || selection === currentPlan}
            onClick={() => void apply()}
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {selection === currentPlan ? "No change" : `Set to ${selection}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
