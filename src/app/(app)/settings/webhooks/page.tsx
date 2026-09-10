"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  Webhook,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { useOrgStore } from "@/lib/org-store";
import { WEBHOOK_EVENT_KEYS, PLAN_LIMITS, PLAN_PRICING, type WebhookEventKey } from "@/lib/constants";
import { cn, formatDateTime } from "@/lib/utils";
import { apiErrorMessage } from "@/components/features/error-handling";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/controls";
import { ConfirmDialog, ConfirmDialogContent } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import type { OrgDTO, WebhookDeliveryDTO, WebhookEndpointDTO } from "@/types";

/* ------------------------- Event metadata --------------------------- */

interface EventMeta {
  key: WebhookEventKey;
  label: string;
  description: string;
  group: "Projects" | "Tasks" | "Comments" | "Sprints" | "Members";
}

const EVENT_META: EventMeta[] = [
  { key: "project.created", label: "Project created", description: "Fires when a new project is created.", group: "Projects" },
  { key: "project.updated", label: "Project updated", description: "Fires when a project's details change.", group: "Projects" },
  { key: "project.deleted", label: "Project deleted", description: "Fires when a project is deleted.", group: "Projects" },
  { key: "task.created", label: "Task created", description: "Fires when a task is created.", group: "Tasks" },
  { key: "task.updated", label: "Task updated", description: "Fires when a task changes (status, assignee, fields).", group: "Tasks" },
  { key: "task.deleted", label: "Task deleted", description: "Fires when a task is deleted.", group: "Tasks" },
  { key: "comment.created", label: "Comment created", description: "Fires when a comment is added to a task.", group: "Comments" },
  { key: "sprint.updated", label: "Sprint updated", description: "Fires when a sprint starts, ends or changes.", group: "Sprints" },
  { key: "member.added", label: "Member added", description: "Fires when someone joins the workspace.", group: "Members" },
  { key: "member.removed", label: "Member removed", description: "Fires when someone leaves or is removed.", group: "Members" },
];

const EVENT_GROUPS = ["Projects", "Tasks", "Comments", "Sprints", "Members"] as const;
const eventsOf = (g: (typeof EVENT_GROUPS)[number]) => EVENT_META.filter((e) => e.group === g).map((e) => e.key);

const STATUS_META: Record<string, { label: string; variant: "success" | "destructive" | "warning" | "muted" }> = {
  success: { label: "Delivered", variant: "success" },
  failed: { label: "Failed", variant: "destructive" },
  pending: { label: "Pending", variant: "warning" },
  cancelled: { label: "Canceled", variant: "muted" },
};

type EndpointWithSecret = WebhookEndpointDTO & { secret?: string };

/* ------------------------------- Page ------------------------------- */

export default function WebhooksSettingsPage() {
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
        <Webhook className="mx-auto size-8 text-muted-foreground" />
        <p className="text-sm font-medium">No workspace selected</p>
        <p className="mx-auto max-w-sm text-[13px] text-muted-foreground">
          Pick a workspace from the switcher in the top bar, then open Webhooks again.
        </p>
      </div>
    );
  }

  if (orgQuery.isLoading || (org && org.id !== orgId)) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (orgQuery.isError || !org) {
    return (
      <div className="space-y-4 rounded-xl border bg-muted/20 p-6 text-center">
        <AlertTriangle className="mx-auto size-8 text-destructive" />
        <p className="text-sm font-medium">Couldn&apos;t load webhooks for this workspace</p>
        <p className="mx-auto max-w-sm text-[13px] text-muted-foreground">
          {orgQuery.error instanceof Error ? orgQuery.error.message : "It may have been deleted, or you no longer have access."}
        </p>
        <Button size="sm" variant="outline" onClick={() => orgQuery.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const canManage = org.myRole === "owner" || org.myRole === "admin"; // webhook.manage
  const plan = org.plan;
  const planAllows = PLAN_LIMITS[plan].webhooks > 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Webhooks</h1>
          <p className="text-[13px] text-muted-foreground">
            Send workspace events to your own services over HTTPS — for {org.name}.
          </p>
        </div>
        {canManage && planAllows ? (
          <EndpointFormDialog orgId={org.id} mode="create" planLimit={PLAN_LIMITS[plan].webhooks} />
        ) : null}
      </div>

      {!planAllows ? (
        <WebhookPlanGateCard org={org} canManage={canManage} />
      ) : null}
      {!canManage ? (
        <Card>
          <CardContent className="flex items-start gap-3 p-5">
            <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Admins can manage webhooks</p>
              <p className="text-[13px] text-muted-foreground">
                Webhook configuration is restricted to owners and admins. You&apos;re viewing as{" "}
                <span className="font-medium capitalize">{org.myRole}</span>.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {canManage ? (
        <>
          <EndpointsSection org={org} planAllows={planAllows} />
          <DeliveriesSection org={org} />
        </>
      ) : null}
    </div>
  );
}

/* --------------------------- Plan gate card ------------------------- */

function WebhookPlanGateCard({ org, canManage }: { org: OrgDTO; canManage: boolean }) {
  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Sparkles className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">Webhooks require the Pro or Business plan</h2>
          <p className="max-w-xl text-[13px] text-muted-foreground">
            Your workspace is on the <span className="font-medium capitalize">{org.plan}</span> plan
            {org.plan === "free" ? ` (${PLAN_LIMITS.free.webhooks} webhooks included)` : ` (${PLAN_LIMITS[org.plan].webhooks} webhooks included)`}
            . Pro includes {PLAN_LIMITS.pro.webhooks} endpoints, Business {PLAN_LIMITS.business.webhooks} — each delivery is signed
            with an HMAC secret and retried with backoff.
          </p>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
            {(["pro", "business"] as const).map((p) => (
              <span key={p} className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-success" aria-hidden /> {PLAN_PRICING[p].monthly !== null ? `$${PLAN_PRICING[p].monthly}` : ""}
                <span className="font-medium capitalize">{p}</span> · {PLAN_LIMITS[p].webhooks} endpoints · unlimited events
              </span>
            ))}
          </div>
        </div>
        {canManage ? (
          <Button asChild size="sm">
            <a href={`/settings/billing?org=${org.id}`}>Upgrade plan</a>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

/* --------------------------- Endpoints list -------------------------- */

function EndpointsSection({ org, planAllows }: { org: OrgDTO; planAllows: boolean }) {
  const query = useQuery({
    queryKey: qk.webhooks(org.id),
    queryFn: () => apiFetch<{ items: WebhookEndpointDTO[] }>(`/api/organizations/${org.id}/webhooks`),
  });
  const items = query.data?.items ?? null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Webhook className="size-4 text-muted-foreground" /> Endpoints
        </CardTitle>
        <CardDescription>
          {items
            ? `${items.length} of ${PLAN_LIMITS[org.plan].webhooks} configured endpoint${items.length === 1 ? "" : "s"}`
            : "Outgoing webhook endpoints for this workspace."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <div className="space-y-2" aria-busy>
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <div className="flex flex-col items-start gap-2 py-4 text-left" role="alert">
            <p className="text-[13px] text-destructive">{apiErrorMessage(query.error, "Couldn't load webhook endpoints.")}</p>
            <Button size="sm" variant="outline" onClick={() => query.refetch()}>
              Try again
            </Button>
          </div>
        ) : items && items.length === 0 ? (
          <div className="py-8 text-center">
            <Webhook className="mx-auto mb-2 size-6 text-muted-foreground" />
            <p className="text-sm font-medium">No webhook endpoints yet</p>
            <p className="text-[13px] text-muted-foreground">
              {planAllows
                ? "Create an endpoint to start receiving workspace events."
                : `Upgrade to ${PLAN_LIMITS[org.plan].webhooks > 0 ? "a larger plan" : "Pro or Business"} to create endpoints.`}
            </p>
          </div>
        ) : items ? (
          <ul role="list" className="space-y-2">
            {items.map((ep) => (
              <EndpointRow key={ep.id} org={org} ep={ep} />
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}

function EndpointRow({ org, ep }: { org: OrgDTO; ep: WebhookEndpointDTO }) {
  const qc = useQueryClient();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [confirm, setConfirm] = React.useState<"rotate" | "delete" | null>(null);
  const [rotateResult, setRotateResult] = React.useState<EndpointWithSecret | null>(null);
  const [toggling, setToggling] = React.useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: qk.webhooks(org.id) });

  const toggle = useMutation({
    mutationFn: (enabled: boolean) =>
      apiFetch<{ endpoint: WebhookEndpointDTO }>(`/api/organizations/${org.id}/webhooks/${ep.id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      }),
    onMutate: () => setToggling(true),
    onSuccess: (data) => {
      toast.success(data.endpoint.enabled ? "Webhook enabled" : "Webhook paused — deliveries will be skipped");
      invalidate();
    },
    onError: (e) => toast.error(apiErrorMessage(e, "Couldn't update the webhook.")),
    onSettled: () => setToggling(false),
  });

  const rotate = useMutation({
    mutationFn: () =>
      apiFetch<{ endpoint: EndpointWithSecret }>(`/api/organizations/${org.id}/webhooks/${ep.id}`, {
        method: "PATCH",
        body: JSON.stringify({ rotateSecret: true }),
      }),
    onSuccess: (data) => {
      setConfirm(null);
      setRotateResult(data.endpoint);
      toast.success("Signing secret rotated");
      invalidate();
    },
    onError: (e) => toast.error(apiErrorMessage(e, "Couldn't rotate the secret.")),
  });

  const remove = useMutation({
    mutationFn: () => apiFetch(`/api/organizations/${org.id}/webhooks/${ep.id}`, { method: "DELETE" }),
    onSuccess: () => {
      setConfirm(null);
      toast.success("Webhook endpoint deleted — pending deliveries were canceled");
      invalidate();
      qc.invalidateQueries({ queryKey: qk.webhookDeliveries(org.id) });
    },
    onError: (e) => toast.error(apiErrorMessage(e, "Couldn't delete the endpoint.")),
  });

  const lastMeta = ep.lastStatus ? STATUS_META[ep.lastStatus] : null;
  const evCount = ep.events.length;

  return (
    <li className="flex flex-col gap-2 rounded-lg border bg-card px-3 py-3 sm:flex-row sm:items-center sm:gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            aria-hidden
            className={cn(
              "mt-1 size-2 shrink-0 rounded-full",
              ep.enabled ? (ep.lastStatus === "failed" ? "bg-destructive" : "bg-success") : "bg-muted-foreground/40"
            )}
          />
          <span className="truncate break-all font-mono text-[13px]">{ep.url}</span>
          <Badge variant={ep.enabled ? "success" : "muted"}>{ep.enabled ? "Active" : "Paused"}</Badge>
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {evCount} event{evCount === 1 ? "" : "s"}:{" "}
          {ep.events
            .map((e) => EVENT_META.find((m) => m.key === e)?.label ?? e)
            .sort()
            .join(", ")}
        </p>
        <p className="text-xs text-muted-foreground">
          Created {formatDateTime(ep.createdAt)}
          {ep.lastDeliveryAt ? ` · Last delivery ${formatDateTime(ep.lastDeliveryAt)}` : " · No deliveries yet"}
          {ep.deliveryCount > 0 ? ` · ${ep.deliveryCount} delivery${ep.deliveryCount === 1 ? "" : "s"}` : ""}
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:justify-end">
        {ep.lastStatus ? (
          <Badge variant={lastMeta?.variant ?? "muted"} className="capitalize">
            {lastMeta?.label ?? ep.lastStatus}
          </Badge>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          aria-label={ep.enabled ? "Pause webhook" : "Activate webhook"}
          disabled={toggling}
          onClick={() => toggle.mutate(!ep.enabled)}
        >
          {ep.enabled ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
        </Button>
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Webhook actions">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setEditOpen(true)}>Edit endpoint</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setConfirm("rotate")}>Rotate signing secret</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setConfirm("delete")}>
              Delete endpoint
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {editOpen ? (
        <EndpointFormDialog
          orgId={org.id}
          mode="edit"
          endpoint={ep}
          onClose={() => setEditOpen(false)}
        />
      ) : null}

      <ConfirmDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <ConfirmDialogContent
          title={confirm === "rotate" ? "Rotate signing secret?" : "Delete this webhook endpoint?"}
          description={
            confirm === "rotate"
              ? "A new HMAC secret will be issued immediately. Update your receiver within the next delivery — deliveries signed with the old secret will fail verification at your end."
              : "This endpoint stops receiving events and its delivery history is canceled. This cannot be undone."
          }
          confirmLabel={confirm === "rotate" ? "Rotate secret" : "Delete endpoint"}
          destructive={confirm === "delete"}
          loading={rotate.isPending || remove.isPending}
          onConfirm={() => {
            if (confirm === "rotate") rotate.mutate();
            else if (confirm === "delete") remove.mutate();
            setConfirm(null);
          }}
        />
      </ConfirmDialog>

      {rotateResult ? (
        <SecretRevealBanner secret={rotateResult.secret ?? ""} onDismiss={() => setRotateResult(null)} />
      ) : null}
    </li>
  );
}

/* ------------------------- Secret reveal banner ---------------------- */

function SecretRevealBanner({ secret, onDismiss }: { secret: string; onDismiss: () => void }) {
  const [show, setShow] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const masked = "••••••••••••••••••••••••••••••••••••••";

  return (
    <div className="rounded-lg border border-amber-300/60 bg-amber-50/70 p-3 dark:border-amber-500/30 dark:bg-amber-500/10" role="status">
      <p className="flex items-center gap-1.5 text-[13px] font-medium text-amber-700 dark:text-amber-300">
        <KeyRound className="size-3.5" /> New signing secret — shown once
      </p>
      <p className="mt-0.5 text-xs text-amber-700/80 dark:text-amber-300/70">
        Copy it now. For security it won&apos;t be shown again and isn&apos;t stored anywhere viewable.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded border bg-card px-2 py-1 font-mono text-xs" aria-label="Signing secret">
          {show ? secret : masked}
        </code>
        <Button
          variant="outline"
          size="sm"
          aria-label={show ? "Hide secret" : "Reveal secret"}
          onClick={() => setShow((s) => !s)}
        >
          {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void navigator.clipboard.writeText(secret);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />} {copied ? "Copied" : "Copy"}
        </Button>
        <Button variant="ghost" size="sm" aria-label="Dismiss" onClick={onDismiss}>
          <X className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

/* --------------------------- Endpoint form --------------------------- */

function parseEndpointUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return "Enter an endpoint URL.";
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return "That doesn't look like a valid URL.";
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return "URL must start with http:// or https://.";
  }
  if (!parsed.hostname) return "URL must include a host.";
  return null;
}

function EndpointFormDialog({
  orgId,
  mode,
  endpoint,
  onClose,
  planLimit,
}: {
  orgId: string;
  mode: "create" | "edit";
  endpoint?: WebhookEndpointDTO;
  onClose?: () => void;
  planLimit?: number;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(mode === "create");
  const [url, setUrl] = React.useState(endpoint?.url ?? "");
  const [events, setEvents] = React.useState<WebhookEventKey[]>(endpoint?.events as WebhookEventKey[] ?? []);
  const [enabled, setEnabled] = React.useState(endpoint?.enabled ?? true);
  const [fieldError, setFieldError] = React.useState<string | null>(null);
  const [createdSecret, setCreatedSecret] = React.useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => {
      const urlError = parseEndpointUrl(url);
      if (urlError) {
        setFieldError(urlError);
        throw new Error(urlError);
      }
      if (events.length === 0) {
        const err = "Pick at least one event.";
        setFieldError(err);
        throw new Error(err);
      }
      setFieldError(null);
      const body = { url: url.trim(), events, ...(mode === "create" ? { enabled } : {}) };
      return apiFetch<{ endpoint: EndpointWithSecret }>(
        `/api/organizations/${orgId}/webhooks${mode === "edit" ? `/${endpoint!.id}` : ""}`,
        { method: mode === "create" ? "POST" : "PATCH", body: JSON.stringify(body) }
      );
    },
    onSuccess: (data) => {
      toast.success(mode === "create" ? "Webhook endpoint created" : "Webhook endpoint updated");
      if (mode === "create") setCreatedSecret(data.endpoint.secret ?? null);
      else {
        setOpen(false);
        onClose?.();
      }
      setUrl("");
      setEvents([]);
      setEnabled(true);
      qc.invalidateQueries({ queryKey: qk.webhooks(orgId) });
    },
    onError: (e) => {
      if (!(e instanceof Error && /valid URL|at least one event/i.test(e.message))) {
        toast.error(apiErrorMessage(e, mode === "create" ? "Couldn't create the webhook." : "Couldn't update the webhook."));
      }
    },
  });

  const toggleEvent = (key: WebhookEventKey) =>
    setEvents((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const setGroup = (group: (typeof EVENT_GROUPS)[number], on: boolean) =>
    setEvents((prev) => {
      const groupKeys = eventsOf(group);
      const without = prev.filter((k) => !groupKeys.includes(k));
      return on ? [...new Set([...without, ...groupKeys])] : without;
    });

  const allSelected = events.length === WEBHOOK_EVENT_KEYS.length;

  return (
    <>
      {mode === "create" ? (
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> New endpoint
        </Button>
      ) : null}
      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : (setOpen(false), onClose?.()))}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "New webhook endpoint" : "Edit webhook endpoint"}</DialogTitle>
            <DialogDescription>
              {mode === "create"
                ? planLimit
                  ? `This workspace can hold up to ${planLimit} endpoints. Events are delivered as signed HTTP POSTs.`
                  : "Events are delivered as signed HTTP POSTs."
                : "Update the URL, events or state. The signing secret never changes unless you rotate it."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="wh-url">Endpoint URL</Label>
              <Input
                id="wh-url"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (fieldError) setFieldError(null);
                }}
                placeholder="https://example.com/hooks/nexora"
                autoComplete="off"
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground">
                We&apos;ll POST JSON with <code className="font-mono">X-Nexora-Signature</code> (HMAC-SHA256 of timestamp + body) so you can verify requests.
              </p>
            </div>

            <fieldset className="space-y-1.5">
              <legend className="mb-1 flex w-full flex-wrap items-center justify-between gap-2">
                <span className="text-[13px] font-medium">Events</span>
                <span className="flex items-center gap-1 text-xs">
                  <label className="flex cursor-pointer items-center gap-1 text-muted-foreground">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(c) => setEvents(c ? [...WEBHOOK_EVENT_KEYS] : [])}
                      aria-label="Select all events"
                    />
                    All
                  </label>
                  {events.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setEvents([])}
                      className="rounded px-1 py-0.5 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    >
                      Clear
                    </button>
                  ) : null}
                </span>
              </legend>
              <div className="rounded-lg border bg-muted/20 p-3">
                {EVENT_GROUPS.map((group) => {
                  const keys = eventsOf(group);
                  const selectedCount = keys.filter((k) => events.includes(k)).length;
                  const checked = selectedCount === keys.length;
                  const indeterminate = selectedCount > 0 && !checked;
                  return (
                    <div key={group} className="py-1.5 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={indeterminate ? "indeterminate" : checked}
                          onCheckedChange={(c) => setGroup(group, c === true || c === "indeterminate")}
                          aria-label={`Select all ${group} events`}
                        />
                        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{group}</span>
                        <span className="text-xs text-muted-foreground/70">
                          {selectedCount}/{keys.length}
                        </span>
                      </div>
                      <ul className="mt-1 grid gap-x-4 gap-y-1 pl-6 sm:grid-cols-2">
                        {EVENT_META.filter((e) => e.group === group).map((meta) => (
                          <li key={meta.key}>
                            <label className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 hover:bg-accent/50">
                              <Checkbox
                                checked={events.includes(meta.key)}
                                onCheckedChange={() => toggleEvent(meta.key)}
                                className="mt-0.5"
                              />
                              <span className="min-w-0">
                                <span className="block font-mono text-xs text-foreground">{meta.key}</span>
                                <span className="block text-[11px] leading-snug text-muted-foreground">{meta.description}</span>
                              </span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">Fires when these events happen anywhere in this workspace.</p>
            </fieldset>

            {mode === "create" ? (
              <div className="flex items-center gap-2">
                <Checkbox id="wh-enabled" checked={enabled} onCheckedChange={(c) => setEnabled(c !== false)} />
                <Label htmlFor="wh-enabled" className="cursor-pointer">Active immediately</Label>
              </div>
            ) : null}

            {fieldError ? (
              <p className="text-[13px] text-destructive" role="alert">
                {fieldError}
              </p>
            ) : null}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={() => (setOpen(false), onClose?.())}>
              Cancel
            </Button>
            <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {mode === "create" ? "Create endpoint" : "Save changes"}
            </Button>
          </div>

          {createdSecret ? (
            <SecretRevealBanner secret={createdSecret} onDismiss={() => setCreatedSecret(null)} />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ------------------------- Deliveries log ---------------------------- */

function DeliveriesSection({ org }: { org: OrgDTO }) {
  const qc = useQueryClient();
  const endpointsQuery = useQuery({
    queryKey: qk.webhooks(org.id),
    queryFn: () => apiFetch<{ items: WebhookEndpointDTO[] }>(`/api/organizations/${org.id}/webhooks`),
  });
  const endpoints = endpointsQuery.data?.items ?? [];
  const [endpointId, setEndpointId] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<"all" | string>("all");
  const [olderPages, setOlderPages] = React.useState<WebhookDeliveryDTO[][]>([]);
  const [hasMore, setHasMore] = React.useState(false);

  const pageSize = 20;
  const fetchPage = async (targetPage: number) => {
    const params = new URLSearchParams({ page: String(targetPage), pageSize: String(pageSize) });
    if (endpointId !== "all") params.set("endpointId", endpointId);
    return apiFetch<{ items: WebhookDeliveryDTO[]; hasMore: boolean; total: number }>(
      `/api/organizations/${org.id}/webhooks/deliveries?${params}`
    );
  };

  const firstPageQuery = useQuery({
    queryKey: [...qk.webhookDeliveries(org.id, endpointId), "p", 1],
    queryFn: () => fetchPage(1),
  });
  const firstPage = firstPageQuery.data?.items ?? [];
  const total = firstPageQuery.data?.total ?? 0;
  const deliveries = [...firstPage, ...olderPages.flat()].filter(
    (d) => statusFilter === "all" || d.status === statusFilter
  );
  const statuses = ["success", "failed", "pending", "cancelled"] as const;

  const switchEndpoint = (value: string) => {
    setEndpointId(value);
    setOlderPages([]);
    setHasMore(false);
  };

  const loadMore = async () => {
    const nextPage = olderPages.length + 2; // page 1 is the query
    try {
      const data = await fetchPage(nextPage);
      setOlderPages((prev) => [...prev, data.items]);
      setHasMore(data.hasMore);
    } catch (e) {
      toast.error(apiErrorMessage(e, "Couldn't load more deliveries."));
    }
  };

  const refreshAll = async () => {
    setOlderPages([]);
    setHasMore(false);
    await firstPageQuery.refetch();
  };

  const retry = useMutation({
    mutationFn: (deliveryId: string) =>
      apiFetch<{ ok: boolean }>(`/api/organizations/${org.id}/webhooks/deliveries/${deliveryId}/retry`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Retry attempted — delivery state updated");
      void refreshAll();
      void qc.invalidateQueries({ queryKey: qk.webhooks(org.id) });
    },
    onError: (e) => toast.error(apiErrorMessage(e, "Couldn't retry the delivery.")),
  });

  const effectiveHasMore = olderPages.length > 0 ? hasMore : (firstPageQuery.data?.hasMore ?? false);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Send className="size-4 text-muted-foreground" /> Delivery log
        </CardTitle>
        <CardDescription>
          Outbound delivery attempts. Payloads and signatures are never displayed here.
        </CardDescription>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Select value={endpointId} onValueChange={switchEndpoint}>
            <SelectTrigger aria-label="Filter by endpoint" className="w-56">
              <SelectValue placeholder="All endpoints" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All endpoints</SelectItem>
              {endpoints.map((ep) => (
                <SelectItem key={ep.id} value={ep.id} className="font-mono text-xs">
                  {ep.url}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex flex-wrap gap-1">
            {(["all", ...statuses] as const).map((st) => (
              <button
                key={st}
                type="button"
                aria-pressed={statusFilter === st}
                onClick={() => setStatusFilter(st)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                  statusFilter === st ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                )}
              >
                {st}
              </button>
            ))}
          </div>
          {total > 0 ? <span className="ml-auto text-xs text-muted-foreground">{total} total</span> : null}
        </div>
      </CardHeader>
      <CardContent>
        {firstPageQuery.isLoading && olderPages.length === 0 ? (
          <div className="space-y-2" aria-busy>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : firstPageQuery.isError && olderPages.length === 0 ? (
          <div className="flex flex-col items-start gap-2 py-4" role="alert">
            <p className="text-[13px] text-destructive">{apiErrorMessage(firstPageQuery.error, "Couldn't load the delivery log.")}</p>
            <Button size="sm" variant="outline" onClick={() => void firstPageQuery.refetch()}>
              Try again
            </Button>
          </div>
        ) : deliveries.length === 0 ? (
          <div className="py-8 text-center">
            <Send className="mx-auto mb-2 size-6 text-muted-foreground" />
            <p className="text-sm font-medium">{statusFilter !== "all" ? "No matching deliveries" : "No deliveries recorded"}</p>
            <p className="text-[13px] text-muted-foreground">
              {statusFilter !== "all"
                ? `No ${statusFilter} deliveries match${endpointId !== "all" ? " this endpoint" : ""}.`
                : endpoints.length === 0
                  ? "Create an endpoint — deliveries will appear here as events fire."
                  : "This endpoint hasn't received matching events yet."}
            </p>
          </div>
        ) : (
          <ul role="list" className="space-y-1">
            {deliveries.map((d) => {
              const meta = STATUS_META[d.status] ?? { label: d.status, variant: "muted" as const };
              const retryable = d.status === "failed" || d.status === "pending";
              return (
                <li key={d.id} className="flex flex-col gap-2 rounded-lg border bg-card px-3 py-2.5 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
                      <span className="text-foreground">{d.event}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">{formatDateTime(d.createdAt)}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {d.statusCode ? `HTTP ${d.statusCode} · ` : ""}attempt{d.attempts === 1 ? "" : "s"}: {d.attempts}
                      {d.lastError ? ` · ${d.lastError}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                    {retryable ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={retry.isPending}
                        onClick={() => retry.mutate(d.id)}
                        aria-label={`Retry delivery ${d.id.slice(0, 8)}`}
                      >
                        {retry.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />} Retry
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {effectiveHasMore ? (
          <div className="mt-3 flex justify-center">
            <Button variant="outline" size="sm" onClick={() => void loadMore()}>
              <ChevronDown className="size-3.5" /> Load older deliveries
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
