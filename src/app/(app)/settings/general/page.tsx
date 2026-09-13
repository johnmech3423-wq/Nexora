"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Building2, CalendarDays, Copy, Loader2, LogOut, ShieldCheck, Trash2, Users } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";import { useOrgStore } from "@/lib/org-store";
import { PLAN_PRICING } from "@/lib/constants";
import { cn, formatDateTime } from "@/lib/utils";
import { apiErrorMessage } from "@/components/features/error-handling";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/controls";
import { ConfirmDialog, ConfirmDialogContent } from "@/components/ui/confirm-dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import type { OrgDTO } from "@/types";

const SETTING_ROWS = [
  {
    key: "restrictProjectVisibility",
    title: "Restrict project visibility",
    description: "Only members added to a project can see it — even when it is not marked private.",
  },
  {
    key: "allowMemberProjects",
    title: "Members can create projects",
    description: "Allow members (not just owners and admins) to create new projects in this workspace.",
  },
  {
    key: "allowMemberChannels",
    title: "Members can create chat channels",
    description: "Allow members to create project channels in chat. Off means owners and admins only.",
  },
] as const;

type SettingKey = (typeof SETTING_ROWS)[number]["key"];

export default function GeneralSettingsPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const { activeOrgId, setActiveOrgId } = useOrgStore();
  const requestedOrg = sp.get("org");

  React.useEffect(() => {
    if (requestedOrg && requestedOrg !== activeOrgId) setActiveOrgId(requestedOrg);
    // Intentionally only reacts to the ?org= param; the store is synced once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedOrg]);

  const orgId = requestedOrg ?? activeOrgId;

  const orgQuery = useQuery({
    queryKey: qk.orgDetail(orgId ?? "_"),
    queryFn: () => apiFetch<{ organization: OrgDTO }>(`/api/organizations/${orgId}`),
    enabled: Boolean(orgId),
  });

  if (!orgId) {
    return (
      <div className="space-y-4 rounded-xl border bg-muted/20 p-6 text-center">
        <Building2 className="mx-auto size-8 text-muted-foreground" />
        <p className="text-sm font-medium">No workspace selected</p>
        <p className="mx-auto max-w-sm text-[13px] text-muted-foreground">
          Pick a workspace from the switcher in the top bar, or use “Workspace settings” from the workspace menu.
        </p>
        <Button size="sm" variant="outline" onClick={() => router.push("/dashboard")}>
          Go to dashboard
        </Button>
      </div>
    );
  }

  if (orgQuery.isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (orgQuery.isError || !orgQuery.data?.organization) {
    return (
      <div className="space-y-4 rounded-xl border bg-muted/20 p-6 text-center">
        <AlertTriangle className="mx-auto size-8 text-destructive" />
        <p className="text-sm font-medium">Couldn&apos;t load this workspace</p>
        <p className="mx-auto max-w-sm text-[13px] text-muted-foreground">
          {orgQuery.error instanceof Error ? orgQuery.error.message : "It may have been deleted, or you no longer have access."}
        </p>
        <Button size="sm" variant="outline" onClick={() => orgQuery.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const org = orgQuery.data.organization;
  const isManager = org.myRole === "owner" || org.myRole === "admin";

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Workspace settings</h1>
          <p className="text-[13px] text-muted-foreground">Manage {org.name} — its identity, defaults and access.</p>
        </div>
        <Badge variant="outline" className="capitalize">
          <ShieldCheck className="mr-1 size-3.5" /> {org.myRole}
        </Badge>
      </div>

      <IdentityCard key={org.id} org={org} canEdit={isManager} />
      <WorkspaceDefaultsCard key={org.id} org={org} canManage={isManager} />
      <DangerZoneCard org={org} />
    </div>
  );
}

/* ------------------------- Workspace identity ------------------------ */

function IdentityCard({ org, canEdit }: { org: OrgDTO; canEdit: boolean }) {
  const qc = useQueryClient();
  const [name, setName] = React.useState(org.name);
  const [description, setDescription] = React.useState(org.description ?? "");
  const [copied, setCopied] = React.useState(false);
  const dirty = name.trim() !== org.name || description !== (org.description ?? "");

  const patch = useMutation({
    mutationFn: () =>
      apiFetch(`/api/organizations/${org.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...(name.trim() !== org.name ? { name: name.trim() } : {}),
          ...(description !== (org.description ?? "") ? { description: description.trim() || null } : {}),
        }),
      }),
    onSuccess: () => {
      toast.success("Workspace updated");
      qc.invalidateQueries({ queryKey: qk.orgDetail(org.id) });
      qc.invalidateQueries({ queryKey: qk.orgList });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const slugOk = name.trim().length >= 2 && name.trim().length <= 80;
  const canSave = dirty && slugOk && !patch.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Building2 className="size-4 text-muted-foreground" /> Workspace identity
        </CardTitle>
        <CardDescription>Name and description are visible to every member of the workspace.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-semibold text-primary" aria-hidden>
            {org.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1 text-[13px] text-muted-foreground">
            <p className="text-sm font-medium text-foreground">{org.name}</p>
            <p className="break-all font-mono text-xs">{org.slug}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void navigator.clipboard.writeText(org.slug);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1200);
            }}
          >
            <Copy className="mr-1 size-3.5" /> {copied ? "Copied" : "Copy slug"}
          </Button>
        </div>

        {canEdit ? (
          <div className="grid gap-3.5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="org-name">Name</Label>
              <Input id="org-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
              {name.trim().length > 0 && name.trim().length < 2 ? (
                <p className="text-xs text-destructive">Use at least 2 characters.</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="org-desc">Description</Label>
              <Textarea id="org-desc" value={description} maxLength={400} rows={2} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
        ) : (
          <p className="text-[13px] text-muted-foreground">
            {org.description || "No description yet."} Only owners and admins can edit workspace details.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-4 border-t pt-3 text-[13px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-4" /> {org.memberCount} member{org.memberCount === 1 ? "" : "s"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-4" /> Created {formatDateTime(org.createdAt)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="capitalize">{org.plan}</span>
            <span className="text-muted-foreground/70">·</span>
            {PLAN_PRICING[org.plan]?.tagline ?? "Free plan"}
          </span>
        </div>

        {canEdit ? (
          <div className="flex justify-end">
            <Button size="sm" disabled={!canSave} onClick={() => patch.mutate()}>
              {patch.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Save changes
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/* ----------------------- Workspace defaults -------------------------- */

function WorkspaceDefaultsCard({ org, canManage }: { org: OrgDTO; canManage: boolean }) {
  const qc = useQueryClient();
  const [values, setValues] = React.useState(org.settings);
  const [pending, setPending] = React.useState<SettingKey | null>(null);

  const update = async (key: SettingKey, value: boolean) => {
    setPending(key);
    const previous = values;
    setValues((v) => ({ ...v, [key]: value }));
    try {
      await apiFetch(`/api/organizations/${org.id}/settings`, {
        method: "PATCH",
        body: JSON.stringify({ [key]: value }),
      });
      toast.success("Default updated");
      qc.invalidateQueries({ queryKey: qk.orgDetail(org.id) });
    } catch (e) {
      setValues(previous);
      toast.error(apiErrorMessage(e));
    } finally {
      setPending(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <ShieldCheck className="size-4 text-muted-foreground" /> Workspace defaults
        </CardTitle>
        <CardDescription>
          Defaults that apply to every project in this workspace.
          {canManage ? " Changes apply immediately." : " Only owners and admins can change these."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {SETTING_ROWS.map((row) => (
          <div
            key={row.key}
            className={cn(
              "flex items-start justify-between gap-4 rounded-lg px-2 py-2.5",
              canManage && "hover:bg-muted/40"
            )}
          >
            <div className="min-w-0">
              <p className="text-[13px] font-medium">{row.title}</p>
              <p className="text-xs text-muted-foreground">{row.description}</p>
            </div>
            <Switch
              aria-label={row.title}
              checked={values[row.key]}
              disabled={!canManage || pending === row.key}
              onCheckedChange={(v) => void update(row.key, v)}
            />
          </div>
        ))}
        {!canManage ? (
          <p className="px-2 pt-2 text-xs text-muted-foreground">
            You&apos;re viewing this workspace as <span className="capitalize">{org.myRole}</span>.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

/* --------------------------- Danger zone ----------------------------- */

function DangerZoneCard({ org }: { org: OrgDTO }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { setActiveOrgId } = useOrgStore();
  const isOwner = org.myRole === "owner";
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const leave = useMutation({
    mutationFn: () => apiFetch(`/api/organizations/${org.id}/leave`, { method: "POST" }),
    onSuccess: async () => {
      toast.success(`You left ${org.name}`);
      await qc.invalidateQueries({ queryKey: qk.orgList });
      setActiveOrgId(null);
      router.push("/dashboard");
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: () => apiFetch(`/api/organizations/${org.id}`, { method: "DELETE" }),
    onSuccess: async () => {
      toast.success("Workspace deleted");
      await qc.invalidateQueries({ queryKey: qk.orgList });
      setActiveOrgId(null);
      router.push("/dashboard");
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm text-destructive">
          <AlertTriangle className="size-4" /> Danger zone
        </CardTitle>
        <CardDescription>
          {isOwner
            ? "Deleting this workspace permanently removes its projects, tasks and files for everyone."
            : "Leave this workspace — you will lose access to its projects and chats."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isOwner ? (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="size-4" /> Delete workspace
          </Button>
        ) : (
          <Button variant="destructive" size="sm" onClick={() => setConfirmOpen(true)}>
            <LogOut className="size-4" /> Leave workspace
          </Button>
        )}

        <ConfirmDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <ConfirmDialogContent
            title={isOwner ? "Delete this workspace?" : `Leave ${org.name}?`}
            description={
              isOwner
                ? `"${org.name}" and all of its data will be permanently deleted. This cannot be undone.`
                : `You'll stop seeing ${org.name} in your workspace switcher. An owner can re-invite you at any time.`
            }
            confirmLabel={isOwner ? "Delete workspace" : "Leave workspace"}
            destructive
            loading={leave.isPending || remove.isPending}
            onConfirm={() => {
              setConfirmOpen(false);
              (isOwner ? remove : leave).mutate();
            }}
          />
        </ConfirmDialog>
      </CardContent>
    </Card>
  );
}
