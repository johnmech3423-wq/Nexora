"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Building2,
  Inbox,
  Loader2,
  MailPlus,
  MoreHorizontal,
  Search,
  Send,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { useMe } from "@/lib/hooks/use-session";
import { useOrgStore } from "@/lib/org-store";
import { ORG_ROLES, ORG_ROLE_LABELS, type OrgRole } from "@/lib/constants";
import { cn, formatDateTime } from "@/lib/utils";
import { apiErrorMessage } from "@/components/features/error-handling";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/field";
import { ConfirmDialog, ConfirmDialogContent } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import type { InvitationDTO, OrgMemberDTO } from "@/types";

type InvitationStatus = InvitationDTO["status"];

const MEMBER_ROLE_LABEL: Record<OrgRole, string> = ORG_ROLE_LABELS;

const INVITATION_STATUS_META: Record<InvitationStatus, { label: string; variant: "warning" | "destructive" | "success" | "muted" }> = {
  pending: { label: "Pending", variant: "warning" },
  expired: { label: "Expired", variant: "destructive" },
  accepted: { label: "Accepted", variant: "success" },
  declined: { label: "Declined", variant: "muted" },
  revoked: { label: "Canceled", variant: "muted" },
};

export default function MembersSettingsPage() {
  const sp = useSearchParams();
  const { activeOrgId, setActiveOrgId } = useOrgStore();
  const requestedOrg = sp.get("org");
  const orgId = requestedOrg ?? activeOrgId;

  React.useEffect(() => {
    if (requestedOrg && requestedOrg !== activeOrgId) setActiveOrgId(requestedOrg);
  }, [requestedOrg, activeOrgId, setActiveOrgId]);

  const orgQuery = useQuery({
    queryKey: qk.orgDetail(orgId ?? "_"),
    queryFn: () => apiFetch<{ organization: import("@/types").OrgDTO }>(`/api/organizations/${orgId}`),
    enabled: Boolean(orgId),
  });

  if (!orgId) {
    return (
      <div className="space-y-4 rounded-xl border bg-muted/20 p-6 text-center">
        <Building2 className="mx-auto size-8 text-muted-foreground" />
        <p className="text-sm font-medium">No workspace selected</p>
        <p className="mx-auto max-w-sm text-[13px] text-muted-foreground">
          Pick a workspace from the switcher in the top bar, then open Members again.
        </p>
      </div>
    );
  }

  if (orgQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (orgQuery.isError || !orgQuery.data?.organization) {
    return (
      <div className="space-y-4 rounded-xl border bg-muted/20 p-6 text-center">
        <AlertTriangle className="mx-auto size-8 text-destructive" />
        <p className="text-sm font-medium">Couldn&apos;t load this workspace</p>
        <p className="text-[13px] text-muted-foreground">
          {orgQuery.error instanceof Error ? orgQuery.error.message : "It may have been deleted or you no longer have access."}
        </p>
        <Button size="sm" variant="outline" onClick={() => orgQuery.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const org = orgQuery.data.organization;
  const canManage = org.myRole === "owner" || org.myRole === "admin";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Members</h1>
          <p className="text-[13px] text-muted-foreground">
            People in {org.name} — roles, access and invitations.
          </p>
        </div>
        {canManage ? <InviteMemberDialog orgId={org.id} actorRole={org.myRole} /> : null}
      </div>
      <MembersSection orgId={org.id} actorRole={org.myRole} canManage={canManage} />
      {canManage ? <InvitationsSection orgId={org.id} /> : null}
      {!canManage ? (
        <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <ShieldCheck className="size-4 shrink-0" />
          You&apos;re viewing as <span className="font-medium capitalize">{org.myRole}</span> — only owners and admins can change
          roles, remove people or send invitations.
        </p>
      ) : null}
    </div>
  );
}

/* ----------------------------- Members ------------------------------ */

function MembersSection({ orgId, actorRole, canManage }: { orgId: string; actorRole: OrgRole; canManage: boolean }) {
  const me = useMe();
  const meId = me.data?.user.id;
  const [query, setQuery] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<OrgRole | "all">("all");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "active" | "suspended">("all");
  const canViewMembers = actorRole !== "guest";

  const membersQuery = useQuery({
    queryKey: qk.members(orgId),
    queryFn: () => apiFetch<{ members: OrgMemberDTO[] }>(`/api/organizations/${orgId}/members`),
    enabled: canViewMembers,
  });

  const members = React.useMemo(() => {
    const haystack = query.trim().toLowerCase();
    return (membersQuery.data?.members ?? []).filter((m) => {
      if (roleFilter !== "all" && m.role !== roleFilter) return false;
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (!haystack) return true;
      return (
        m.name.toLowerCase().includes(haystack) ||
        m.email.toLowerCase().includes(haystack) ||
        m.title?.toLowerCase().includes(haystack)
      );
    });
  }, [membersQuery.data, query, roleFilter, statusFilter]);

  const counts = React.useMemo(() => {
    const all = membersQuery.data?.members ?? [];
    return {
      total: all.length,
      active: all.filter((m) => m.status === "active").length,
      suspended: all.filter((m) => m.status === "suspended").length,
    };
  }, [membersQuery.data]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Users className="size-4 text-muted-foreground" /> Team members
        </CardTitle>
        <CardDescription>
          {counts.total} member{counts.total === 1 ? "" : "s"}
          {counts.suspended > 0 ? ` · ${counts.suspended} suspended` : ""}
        </CardDescription>
        <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              role="searchbox"
              aria-label="Search members"
              placeholder="Search by name, email or title…"
              className="pl-8"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as OrgRole | "all")}>
              <SelectTrigger aria-label="Filter by role" className="w-36">
                <SelectValue placeholder="All roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {ORG_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {MEMBER_ROLE_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger aria-label="Filter by status" className="w-36">
                <SelectValue placeholder="Any status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {!canViewMembers ? (
          <div className="py-8 text-center">
            <ShieldCheck className="mx-auto mb-2 size-6 text-muted-foreground" />
            <p className="text-sm font-medium">Member directory is private</p>
            <p className="mx-auto max-w-sm text-[13px] text-muted-foreground">
              Guests can&apos;t view the member list in this workspace. Ask an owner or admin if you need access.
            </p>
          </div>
        ) : membersQuery.isLoading ? (
          <div className="space-y-2" aria-busy>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : membersQuery.isError ? (
          <p className="text-[13px] text-destructive">{apiErrorMessage(membersQuery.error, "Couldn't load members.")}</p>
        ) : members.length === 0 ? (
          <div className="py-8 text-center">
            <UserRound className="mx-auto mb-2 size-6 text-muted-foreground" />
            <p className="text-sm font-medium">{query || roleFilter !== "all" || statusFilter !== "all" ? "No matching members" : "No members yet"}</p>
            <p className="text-[13px] text-muted-foreground">Try a different search or filter.</p>
          </div>
        ) : (
          <ul role="list" className="space-y-1">
            {members.map((m) => (
              <li key={m.id}>
                <MemberRow member={m} orgId={orgId} actorRole={actorRole} canManage={canManage} isMe={m.userId === meId} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Policy mirror of the server's assertCanManageRole (backend remains the authority). */
function canManageTarget(actorRole: OrgRole, targetRole: OrgRole, isSelf: boolean): boolean {
  if (targetRole === "owner") return false;
  if (isSelf) return actorRole === "owner"; // owners may self-demote; everyone else keeps their role
  if (actorRole === "owner") return true;
  if (actorRole === "admin") return targetRole === "member" || targetRole === "guest";
  return false;
}

function MemberRow({
  member,
  orgId,
  actorRole,
  canManage,
  isMe,
}: {
  member: OrgMemberDTO;
  orgId: string;
  actorRole: OrgRole;
  canManage: boolean;
  isMe: boolean;
}) {
  const qc = useQueryClient();
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [confirm, setConfirm] = React.useState<"remove" | "suspend" | "activate" | null>(null);
  const manageable = canManageTarget(actorRole, member.role, isMe);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: qk.members(orgId) });
    qc.invalidateQueries({ queryKey: qk.orgDetail(orgId) });
  };

  const roleMutation = useMutation({
    mutationFn: (role: OrgRole) =>
      apiFetch(`/api/organizations/${orgId}/members/${member.userId}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      }),
    onSuccess: (_data, role) => {
      toast.success(`Role updated to ${MEMBER_ROLE_LABEL[role]}`);
      invalidate();
    },
    onError: (e) => toast.error(apiErrorMessage(e, "Couldn't update the role.")),
  });

  const statusMutation = useMutation({
    mutationFn: (status: "active" | "suspended") =>
      apiFetch(`/api/organizations/${orgId}/members/${member.userId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      toast.success(member.status === "suspended" ? "Member reactivated" : "Member suspended");
      invalidate();
    },
    onError: (e) => toast.error(apiErrorMessage(e, "Couldn't change the status.")),
  });

  const removeMutation = useMutation({
    mutationFn: () => apiFetch(`/api/organizations/${orgId}/members/${member.userId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(`${member.name} removed from the workspace`);
      invalidate();
    },
    onError: (e) => toast.error(apiErrorMessage(e, "Couldn't remove the member.")),
  });

  const roleOptions: OrgRole[] = React.useMemo(() => {
    if (!manageable) return [];
    const options = ORG_ROLES.filter((r) => r !== "owner" || (actorRole === "owner" && !isMe && member.role !== "owner"));
    return options;
  }, [manageable, actorRole, isMe, member.role]);

  return (
    <>
      <div className="flex flex-col gap-2 rounded-lg border bg-card px-3 py-2.5 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:gap-3">
        <button
          type="button"
          onClick={() => setProfileOpen(true)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`View ${member.name}`}
        >
          <Avatar name={member.name} src={member.avatarUrl} size="md" />
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-1.5 text-[13px] font-medium">
              <span className="truncate">{member.name}</span>
              {isMe ? <Badge variant="muted" className="normal-case">You</Badge> : null}
              {member.role === "owner" ? <Badge variant="secondary">Owner</Badge> : null}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {member.email}
              {member.title ? ` · ${member.title}` : ""}
            </span>
          </span>
        </button>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <span className="hidden text-xs text-muted-foreground md:block">Joined {formatDateTime(member.joinedAt)}</span>
          <Badge variant={member.status === "active" ? "success" : "destructive"} className="capitalize">
            {member.status === "active" ? "Active" : "Suspended"}
          </Badge>

          {canManage && manageable && roleOptions.length > 0 ? (
            <Select
              value={member.role === "owner" ? "owner" : member.role}
              disabled={roleMutation.isPending}
              onValueChange={(v) => roleMutation.mutate(v as OrgRole)}
            >
              <SelectTrigger aria-label={`Change ${member.name}'s role`} className="h-8 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((r) => (
                  <SelectItem key={r} value={r}>
                    {MEMBER_ROLE_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : canManage ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : null}

          {canManage ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${member.name}`}>
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setProfileOpen(true)}>View profile</DropdownMenuItem>
                {manageable && member.status === "active" && !isMe ? (
                  <DropdownMenuItem onSelect={() => setConfirm("suspend")}>Suspend member</DropdownMenuItem>
                ) : null}
                {manageable && member.status === "suspended" ? (
                  <DropdownMenuItem onSelect={() => setConfirm("activate")}>Reactivate member</DropdownMenuItem>
                ) : null}
                {manageable && !isMe ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setConfirm("remove")}>
                      Remove from workspace
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      {canManage && manageable && !isMe ? (
        <ConfirmDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
          <ConfirmDialogContent
            title={
              confirm === "remove"
                ? `Remove ${member.name}?`
                : confirm === "suspend"
                  ? `Suspend ${member.name}?`
                  : `Reactivate ${member.name}?`
            }
            description={
              confirm === "remove"
                ? `${member.name} will immediately lose access to this workspace and its projects. You can invite them again later.`
                : confirm === "suspend"
                  ? `${member.name} keeps their seat but can't access this workspace until reactivated.`
                  : `${member.name} regains full access according to their ${MEMBER_ROLE_LABEL[member.role].toLowerCase()} role.`
            }
            confirmLabel={
              confirm === "remove" ? "Remove member" : confirm === "suspend" ? "Suspend" : "Reactivate"
            }
            destructive={confirm !== "activate"}
            loading={removeMutation.isPending || statusMutation.isPending}
            onConfirm={() => {
              if (confirm === "remove") removeMutation.mutate();
              else if (confirm === "suspend" || confirm === "activate") statusMutation.mutate(confirm === "suspend" ? "suspended" : "active");
              setConfirm(null);
            }}
          />
        </ConfirmDialog>
      ) : null}

      <MemberProfileDialog member={member} open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
}

function MemberProfileDialog({
  member,
  open,
  onOpenChange,
}: {
  member: OrgMemberDTO;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Member profile</DialogTitle>
          <DialogDescription>Workspace membership details.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-3">
          <Avatar name={member.name} src={member.avatarUrl} size="lg" />
          <div className="min-w-0">
            <p className="truncate font-medium">{member.name}</p>
            <p className="truncate text-[13px] text-muted-foreground">{member.email}</p>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[13px]">
          <dt className="text-muted-foreground">Role</dt>
          <dd className="font-medium capitalize">{member.role}</dd>
          <dt className="text-muted-foreground">Status</dt>
          <dd className="font-medium capitalize">{member.status}</dd>
          <dt className="text-muted-foreground">Joined</dt>
          <dd>{formatDateTime(member.joinedAt)}</dd>
          <dt className="text-muted-foreground">Last active</dt>
          <dd>{member.lastActiveAt ? formatDateTime(member.lastActiveAt) : "—"}</dd>
          {member.title ? (
            <>
              <dt className="text-muted-foreground">Title</dt>
              <dd>{member.title}</dd>
            </>
          ) : null}
        </dl>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------- Invitations ---------------------------- */

function InvitationsSection({ orgId }: { orgId: string }) {
  const [filter, setFilter] = React.useState<"all" | "pending" | "expired">("all");
  const invitationsQuery = useQuery({
    queryKey: qk.invitations(orgId),
    queryFn: () => apiFetch<{ invitations: InvitationDTO[] }>(`/api/organizations/${orgId}/invitations`),
  });
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: qk.invitations(orgId) });

  const resend = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/organizations/${orgId}/invitations/${id}/resend`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Invitation resent — a fresh link was emailed");
      invalidate();
    },
    onError: (e) => toast.error(apiErrorMessage(e, "Couldn't resend the invitation.")),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/organizations/${orgId}/invitations/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Invitation canceled");
      invalidate();
    },
    onError: (e) => toast.error(apiErrorMessage(e, "Couldn't cancel the invitation.")),
  });

  const invitations = (invitationsQuery.data?.invitations ?? []).filter((i) =>
    filter === "all" ? true : i.status === filter
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <MailPlus className="size-4 text-muted-foreground" /> Invitations
        </CardTitle>
        <CardDescription>
          Pending invites expire 7 days after they&apos;re sent. Invitation links only ever travel by email.
        </CardDescription>
        <div className="flex gap-2 pt-1">
          {(
            [
              ["all", "All"],
              ["pending", "Pending"],
              ["expired", "Expired"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                filter === value ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {invitationsQuery.isLoading ? (
          <div className="space-y-2" aria-busy>
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : invitationsQuery.isError ? (
          <p className="text-[13px] text-destructive">{apiErrorMessage(invitationsQuery.error, "Couldn't load invitations.")}</p>
        ) : invitations.length === 0 ? (
          <div className="py-8 text-center">
            <Inbox className="mx-auto mb-2 size-6 text-muted-foreground" />
            <p className="text-sm font-medium">No {filter === "all" ? "" : `${filter} `}invitations</p>
            <p className="text-[13px] text-muted-foreground">
              {filter === "pending"
                ? "Invite people by email and they'll show up here while their invite is pending."
                : "Invitations you send will appear here."}
            </p>
          </div>
        ) : (
          <ul role="list" className="space-y-1">
            {invitations.map((inv) => {
              const meta = INVITATION_STATUS_META[inv.status];
              return (
                <li key={inv.id} className="flex flex-col gap-2 rounded-lg border bg-card px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar name={inv.email} size="md" />
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-1.5 text-[13px] font-medium">
                        <span className="truncate">{inv.email}</span>
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {MEMBER_ROLE_LABEL[inv.role]} · invited by {inv.invitedByName} · {formatDateTime(inv.invitedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {inv.status === "pending" ? (
                      <span className="text-xs text-muted-foreground">Expires {formatDateTime(inv.expiresAt)}</span>
                    ) : null}
                    {inv.status === "pending" ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!inv.canResend || resend.isPending || revoke.isPending}
                          onClick={() => resend.mutate(inv.id)}
                        >
                          {resend.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} Resend
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          disabled={resend.isPending || revoke.isPending}
                          onClick={() => revoke.mutate(inv.id)}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : inv.status === "expired" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        disabled={revoke.isPending}
                        onClick={() => revoke.mutate(inv.id)}
                      >
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------------------------- Invite dialog -------------------------- */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseEmails(raw: string): string[] {
  return [...new Set(raw.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))];
}

function InviteMemberDialog({ orgId, actorRole }: { orgId: string; actorRole: OrgRole }) {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [emailsRaw, setEmailsRaw] = React.useState("");
  const [role, setRole] = React.useState<OrgRole>(actorRole === "owner" ? "member" : "member");
  const [message, setMessage] = React.useState("");
  const [clientError, setClientError] = React.useState<string | null>(null);

  const roleOptions: OrgRole[] = actorRole === "owner" ? ["member", "admin", "guest", "owner"] : ["member", "admin", "guest"];

  const invite = useMutation({
    mutationFn: () =>
      apiFetch<{ invitations: InvitationDTO[]; skippedExisting: string[] }>(
        `/api/organizations/${orgId}/invitations`,
        {
          method: "POST",
          body: JSON.stringify({
            emails: parseEmails(emailsRaw),
            role,
            ...(message.trim() ? { message: message.trim() } : {}),
          }),
        }
      ),
    onSuccess: (data) => {
      const sent = data.invitations.length;
      toast.success(
        sent === 1
          ? `Invitation sent to ${data.invitations[0].email}`
          : `${sent} invitation${sent === 1 ? "" : "s"} sent`
      );
      if (data.skippedExisting.length > 0) {
        toast.warning(`${data.skippedExisting.join(", ")} ${data.skippedExisting.length === 1 ? "is" : "are"} already a member or already invited`);
      }
      setOpen(false);
      setEmailsRaw("");
      setMessage("");
      setClientError(null);
      qc.invalidateQueries({ queryKey: qk.invitations(orgId) });
    },
    onError: (e) => toast.error(apiErrorMessage(e, "Couldn't send the invitation.")),
  });

  const submit = () => {
    const emails = parseEmails(emailsRaw);
    if (emails.length === 0) {
      setClientError("Add at least one email address.");
      return;
    }
    const invalid = emails.filter((e) => !EMAIL_RE.test(e));
    if (invalid.length > 0) {
      setClientError(`Invalid email address: ${invalid.join(", ")}`);
      return;
    }
    if (emails.length > 20) {
      setClientError("You can invite up to 20 people at once.");
      return;
    }
    setClientError(null);
    invite.mutate();
  };

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <MailPlus className="size-4" /> Invite people
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Invite people</DialogTitle>
            <DialogDescription>
              They&apos;ll receive an email with a personal link to join. Invites expire after 7 days.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="invite-emails">Email addresses</Label>
              <Textarea
                id="invite-emails"
                value={emailsRaw}
                onChange={(e) => setEmailsRaw(e.target.value)}
                placeholder={"ada@example.com\nbrian@example.com"}
                rows={3}
                aria-describedby="invite-emails-hint"
              />
              <p id="invite-emails-hint" className="text-xs text-muted-foreground">
                One per line, or separated by commas — up to 20 at once. Existing members and pending invites are skipped.
              </p>
            </div>

            <div className="grid gap-3.5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="invite-role">Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as OrgRole)}>
                  <SelectTrigger id="invite-role" aria-label="Invite role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((r) => (
                      <SelectItem key={r} value={r}>
                        {MEMBER_ROLE_LABEL[r]}
                        {r === "owner" ? " (owner only)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-msg">Message (optional)</Label>
                <Input
                  id="invite-msg"
                  value={message}
                  maxLength={500}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Short note included in the email"
                />
              </div>
            </div>

            {clientError ? <p className="text-[13px] text-destructive">{clientError}</p> : null}
            {invite.isError ? (
              <p className="text-[13px] text-destructive">{apiErrorMessage(invite.error, "Couldn't send the invitation.")}</p>
            ) : null}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={invite.isPending} onClick={submit}>
              {invite.isPending ? <Loader2 className="size-4 animate-spin" /> : <MailPlus className="size-4" />} Send invitation
              {parseEmails(emailsRaw).length > 1 ? `s (${parseEmails(emailsRaw).length})` : ""}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
