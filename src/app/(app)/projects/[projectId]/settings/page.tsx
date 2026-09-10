"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Archive,
  ArchiveRestore,
  GripVertical,
  Pencil,
  Plus,
  Save,
  Tag,
  Trash2,
  Users,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { useActiveOrgId } from "@/lib/hooks/use-session";
import { useMe } from "@/lib/hooks/use-session";
import { apiErrorMessage } from "@/components/features/error-handling";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { ErrorState } from "@/components/ui/state";
import { ConfirmDialog, ConfirmDialogContent } from "@/components/ui/confirm-dialog";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FieldError,
  FormProvider,
} from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { ProjectDetailDTO, OrgMemberDTO } from "@/types";

const generalSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters.").max(120),
    description: z.string().trim().max(4000).optional(),
    private: z.boolean().optional(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to change." });

type GeneralValues = z.infer<typeof generalSchema>;

const SWATCHES = ["#8b5cf6", "#3b82f6", "#06b6d4", "#10b981", "#84cc16", "#f59e0b", "#ef4444", "#ec4899", "#64748b", "#0ea5e9", "#f97316", "#14b8a6"];

export default function ProjectSettingsPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const orgId = useActiveOrgId();
  const router = useRouter();
  const qc = useQueryClient();
  const me = useMe();

  const detail = useQuery({
    queryKey: qk.project(orgId ?? "x", projectId),
    queryFn: () => apiFetch<{ project: ProjectDetailDTO }>(`/api/projects/${projectId}?orgId=${orgId}`),
    enabled: Boolean(orgId),
  });
  const orgMembers = useQuery({
    queryKey: ["org-members", orgId],
    queryFn: () => apiFetch<{ members: OrgMemberDTO[] }>(`/api/organizations/${orgId}/members`),
    enabled: Boolean(orgId),
  });

  const p = detail.data?.project;

  if (!orgId || !projectId) return null;
  if (detail.isLoading && !p) return <CardSkeleton className="h-72" />;
  if (detail.isError || !p)
    return <ErrorState title="Couldn't load project settings" message={apiErrorMessage(detail.error)} onRetry={() => void detail.refetch()} />;

  if (p.myRole !== "manager") {
    return (
      <ErrorState
        title="Managers only"
        message="Only project managers can change settings for this project."
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <GeneralSection project={p} orgId={orgId} projectId={projectId} />
      <StatusesSection project={p} orgId={orgId} projectId={projectId} />
      <LabelsSection project={p} orgId={orgId} projectId={projectId} />
      <MembersSection
        project={p}
        orgId={orgId}
        projectId={projectId}
        orgMemberOptions={orgMembers.data?.members ?? []}
        meId={me.data?.user?.id ?? null}
      />
      <DangerSection project={p} orgId={orgId} projectId={projectId} onDeleted={() => router.push("/projects")} />
    </div>
  );
}

/* ------------------------------ General ------------------------------ */
function GeneralSection({ project, orgId, projectId }: { project: ProjectDetailDTO; orgId: string; projectId: string }) {
  const qc = useQueryClient();
  const [color, setColor] = React.useState<string | null>(project.color);
  const form = useForm<GeneralValues>({
    resolver: zodResolver(generalSchema),
    defaultValues: {
      name: project.name,
      description: project.description ?? "",
    },
  });
  const [saving, setSaving] = React.useState(false);

  const submit = async (values: GeneralValues) => {
    setSaving(true);
    try {
      await apiFetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...values,
          description: values.description || null,
          color: color ?? undefined,
        }),
      });
      toast.success("Project updated");
      qc.invalidateQueries({ queryKey: qk.project(orgId, projectId) });
      qc.invalidateQueries({ queryKey: qk.projects(orgId) });
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">General</CardTitle>
        <CardDescription>Identity and dates shown across the workspace.</CardDescription>
      </CardHeader>
      <CardContent>
        <FormProvider {...form}>
          <form id="proj-general" onSubmit={form.handleSubmit(submit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project name</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FieldError name="name" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} value={field.value ?? ""} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormItem>
              <FormLabel>Color</FormLabel>
              <div role="radiogroup" aria-label="Project color" className="flex flex-wrap gap-1.5">
                {SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={color === c}
                    onClick={() => setColor(c)}
                    className={cn("size-6 rounded-full ring-offset-2", color === c && "ring-2 ring-foreground")}
                    style={{ background: c }}
                    aria-label={`Color ${c}`}
                  />
                ))}
                {color && !SWATCHES.includes(color) ? (
                  <button
                    type="button"
                    role="radio"
                    aria-checked
                    className="size-6 rounded-full ring-2 ring-foreground ring-offset-2"
                    style={{ background: color }}
                    onClick={() => setColor(null)}
                    aria-label={`Current color ${color} (click to remove)`}
                    title="Click to reset"
                  />
                ) : null}
              </div>
            </FormItem>
          </form>
        </FormProvider>
        <div className="mt-4 flex justify-end">
          <Button type="submit" form="proj-general" loading={saving}>
            <Save /> Save changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ----------------------------- Statuses ------------------------------ */
function StatusesSection({ project, orgId, projectId }: { project: ProjectDetailDTO; orgId: string; projectId: string }) {
  const qc = useQueryClient();
  const toRows = (statuses: ProjectDetailDTO["statuses"]) =>
    statuses.map((s) => ({ key: s.key, label: s.label, color: s.color, index: (s as { index?: number }).index ?? 0 }));
  const [rows, setRows] = React.useState(() => toRows(project.statuses));
  // Re-seed the local editable rows when fresh project data arrives
  // (derived-state pattern — no effect round-trip).
  const [syncedStatuses, setSyncedStatuses] = React.useState(project.statuses);
  if (project.statuses !== syncedStatuses) {
    setSyncedStatuses(project.statuses);
    setRows(toRows(project.statuses));
  }
  const [saving, setSaving] = React.useState(false);
  const [confirmReset, setConfirmReset] = React.useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch(`/api/projects/${projectId}/statuses`, {
        method: "PUT",
        body: JSON.stringify({ statuses: rows.map((r) => ({ key: r.key, label: r.label.trim(), color: r.color })) }),
      });
      toast.success("Board statuses updated");
      qc.invalidateQueries({ queryKey: qk.project(orgId, projectId) });
      qc.invalidateQueries({ queryKey: qk.board(orgId, projectId) });
      qc.invalidateQueries({ queryKey: qk.tasks(orgId, projectId) });
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const move = (i: number, dir: -1 | 1) => {
    setRows((rs) => {
      const next = [...rs];
      const j = i + dir;
      if (j < 0 || j >= next.length) return rs;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const updateRow = (i: number, patch: Partial<(typeof rows)[number]>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const removeRow = (i: number) => {
    setRows((rs) => {
      const next = rs.filter((_, idx) => idx !== i);
      if (next.length < 2) {
        toast.error("A project needs at least two statuses.");
        return rs;
      }
      return next;
    });
  };

  const addRow = () => {
    setRows((rs) => {
      if (rs.length >= 12) {
        toast.error("Maximum 12 statuses.");
        return rs;
      }
      const used = new Set(rs.map((r) => r.key));
      let n = rs.length + 1;
      let key = `status_${n}`;
      while (used.has(key)) {
        n += 1;
        key = `status_${n}`;
      }
      return [...rs, { key, label: `New status ${n}`, color: SWATCHES[n % SWATCHES.length], index: rs.length }];
    });
  };

  const dirty = JSON.stringify(rows.map((r) => [r.key, r.label, r.color])) !==
    JSON.stringify(project.statuses.map((s) => [s.key, s.label, s.color]));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Board columns</CardTitle>
        <CardDescription>
          Rename, recolor or reorder columns. <span className="font-mono">done</span> is the column used to count
          completed work; the first column is where tasks land.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2" aria-label="Statuses">
          {rows.map((r, i) => (
            <li key={r.key} className="flex items-center gap-2 rounded-lg border bg-card/60 p-2">
              <GripVertical className="size-4 shrink-0 text-muted-foreground/50" aria-hidden />
              <button
                type="button"
                aria-label={`Move ${r.label} up`}
                disabled={i === 0}
                onClick={() => move(i, -1)}
                className="rounded px-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`Move ${r.label} down`}
                disabled={i === rows.length - 1}
                onClick={() => move(i, 1)}
                className="rounded px-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                ↓
              </button>
              <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: r.color }} />
              <Input
                value={r.label}
                onChange={(e) => updateRow(i, { label: e.target.value })}
                aria-label="Column label"
                className="h-8 w-44 flex-1 text-[13px]"
                maxLength={40}
              />
              <select
                value={r.color}
                onChange={(e) => updateRow(i, { color: e.target.value })}
                aria-label="Column color"
                className="h-8 rounded-md border bg-card px-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {SWATCHES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <code className="hidden w-24 truncate text-[10px] text-muted-foreground sm:block">{r.key}</code>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Delete ${r.label}`}
                className="text-muted-foreground hover:text-destructive"
                onClick={() => removeRow(i)}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
        <Button variant="outline" size="sm" onClick={addRow}>
          <Plus /> Add column
        </Button>
        <div className="flex items-center justify-between border-t pt-3">
          <p className="text-xs text-muted-foreground">
            {dirty ? "Unsaved column changes" : "All column changes are saved"}
          </p>
          <Button size="sm" onClick={() => void save()} loading={saving} disabled={!dirty}>
            <Save /> Save columns
          </Button>
        </div>
        {dirty ? (
          <p className="text-[11px] text-muted-foreground/80">
            Tip: columns you delete keep their tasks — they move to the first column.
          </p>
        ) : null}
        <ConfirmDialog open={confirmReset} onOpenChange={setConfirmReset}>
          <ConfirmDialogContent title="Reset columns?" description="Restore the default board setup." confirmLabel="Reset" onConfirm={() => { setRows([]); setConfirmReset(false); }} />
        </ConfirmDialog>
      </CardContent>
    </Card>
  );
}

/* ------------------------------ Labels ------------------------------- */
function LabelsSection({ project, orgId, projectId }: { project: ProjectDetailDTO; orgId: string; projectId: string }) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: qk.project(orgId, projectId) });
    qc.invalidateQueries({ queryKey: qk.board(orgId, projectId) });
  };
  const [draft, setDraft] = React.useState("");
  const [draftColor, setDraftColor] = React.useState(SWATCHES[0]);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const createLabel = async () => {
    const name = draft.trim();
    if (!name) return;
    setBusy(true);
    try {
      await apiFetch(`/api/projects/${projectId}/labels`, {
        method: "POST",
        body: JSON.stringify({ name, color: draftColor }),
      });
      setDraft("");
      invalidate();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (labelId: string) => {
    const name = editName.trim();
    if (!name) return;
    setBusy(true);
    try {
      await apiFetch(`/api/projects/${projectId}/labels/${labelId}`, {
        method: "PATCH",
        body: JSON.stringify({ name, color: draftColor }),
      });
      setEditId(null);
      invalidate();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const deleteLabel = async (labelId: string) => {
    setBusy(true);
    try {
      await apiFetch(`/api/projects/${projectId}/labels/${labelId}`, { method: "DELETE" });
      invalidate();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const [toDelete, setToDelete] = React.useState<{ id: string; name: string } | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Labels</CardTitle>
        <CardDescription>Labels tag tasks across the board (e.g. design, bug, customer).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="New label name"
            maxLength={30}
            className="h-9 w-56"
            onKeyDown={(e) => e.key === "Enter" && void createLabel()}
          />
          <ColorDots value={draftColor} onChange={setDraftColor} />
          <Button size="sm" onClick={() => void createLabel()} loading={busy} disabled={!draft.trim()}>
            <Plus /> Add
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {project.labels.length === 0 ? (
            <p className="py-2 text-[13px] text-muted-foreground">No labels yet.</p>
          ) : (
            project.labels.map((l) =>
              editId === l.id ? (
                <div key={l.id} className="flex items-center gap-1.5 rounded-full border bg-card p-1 pl-2">
                  <Input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-6 w-32 text-[11px]"
                    maxLength={30}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void saveEdit(l.id);
                      if (e.key === "Escape") setEditId(null);
                    }}
                  />
                  <select
                    value={draftColor}
                    onChange={(e) => setDraftColor(e.target.value)}
                    aria-label="Label color"
                    className="h-6 rounded border bg-card text-[10px]"
                  >
                    {SWATCHES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <Button size="icon-sm" variant="ghost" className="h-6 w-6" aria-label="Save label" onClick={() => void saveEdit(l.id)}>
                    <Save className="size-3" />
                  </Button>
                </div>
              ) : (
                <span key={l.id} className="group inline-flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2.5 text-[12px] font-medium" style={{ background: `${l.color}22`, color: l.color }}>
                  <Tag className="size-3" aria-hidden /> {l.name}
                  <span className="text-[10px] opacity-70">· {l.used}</span>
                  <button
                    type="button"
                    aria-label={`Edit label ${l.name}`}
                    onClick={() => { setEditId(l.id); setEditName(l.name); setDraftColor(l.color); }}
                    className="rounded-full p-0.5 opacity-0 transition-opacity hover:bg-black/10 group-hover:opacity-100"
                  >
                    <Pencil className="size-2.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete label ${l.name}`}
                    onClick={() => setToDelete({ id: l.id, name: l.name })}
                    className="rounded-full p-0.5 opacity-0 transition-opacity hover:bg-black/10 group-hover:opacity-100"
                  >
                    <Trash2 className="size-2.5" />
                  </button>
                </span>
              )
            )
          )}
        </div>
        <ConfirmDialog open={Boolean(toDelete)} onOpenChange={(o) => !o && setToDelete(null)}>
          <ConfirmDialogContent
            title="Delete label?"
            description={toDelete ? `“${toDelete.name}” is removed from all tasks using it.` : ""}
            confirmLabel="Delete label"
            destructive
            onConfirm={() => toDelete && void deleteLabel(toDelete.id)}
          />
        </ConfirmDialog>
      </CardContent>
    </Card>
  );
}

function ColorDots({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Color">
      {SWATCHES.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={`Color ${c}`}
          onClick={() => onChange(c)}
          className={cn("size-5 rounded-full ring-offset-1", value === c && "ring-2 ring-foreground")}
          style={{ background: c }}
        />
      ))}
    </div>
  );
}

/* ------------------------------ Members ------------------------------ */
function MembersSection({
  project,
  orgId,
  projectId,
  orgMemberOptions,
  meId,
}: {
  project: ProjectDetailDTO;
  orgId: string;
  projectId: string;
  orgMemberOptions: OrgMemberDTO[];
  meId: string | null;
}) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: qk.project(orgId, projectId) });
  };
  const [busy, setBusy] = React.useState(false);
  const [toRemove, setToRemove] = React.useState<{ userId: string; name: string } | null>(null);

  const existing = new Set(project.members.map((m) => m.userId));
  const candidates = orgMemberOptions.filter((m) => !existing.has(m.userId));

  const addMember = async (userId: string, role: string) => {
    setBusy(true);
    try {
      await apiFetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        body: JSON.stringify({ userId, role: role === "manager" ? "manager" : role === "viewer" ? "viewer" : undefined }),
      });
      toast.success("Member added");
      invalidate();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const setRole = async (userId: string, role: string) => {
    try {
      await apiFetch(`/api/projects/${projectId}/members/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      invalidate();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  const removeMember = async (userId: string) => {
    setBusy(true);
    try {
      await apiFetch(`/api/projects/${projectId}/members/${userId}`, { method: "DELETE" });
      toast.success("Member removed");
      invalidate();
      setToRemove(null);
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Members</CardTitle>
        <CardDescription>Who can see this project, and what they can do.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Combobox
            options={candidates.map((m) => ({ value: m.userId, label: m.name, hint: m.email }))}
            value={null}
            onValueChange={(v) => v && void addMember(v, "member")}
            placeholder="Add a member…"
            searchPlaceholder="Search org members…"
            emptyLabel="Everyone in this workspace is already a member."
            width="w-64"
          />
        </div>
        <ul className="divide-y rounded-lg border">
          {project.members.map((m) => (
            <li key={m.userId} className="flex items-center gap-3 p-2.5">
              <Avatar name={m.name} src={m.avatarUrl} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">
                  {m.name}
                  {m.userId === meId ? <span className="ml-1 text-[10px] font-normal text-muted-foreground">(you)</span> : null}
                  {m.orgRole === "owner" ? <span className="ml-1 rounded bg-secondary px-1 text-[9px] font-semibold text-muted-foreground uppercase">org owner</span> : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">{m.email}</p>
              </div>
              {m.userId === meId ? (
                <Badge variant="muted" className="capitalize">{m.role}</Badge>
              ) : (
                <Select value={m.role} onValueChange={(r) => void setRole(m.userId, r)}>
                  <SelectTrigger aria-label={`Role of ${m.name}`} className="h-8 w-28 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {m.userId !== meId ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${m.name}`}
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => setToRemove({ userId: m.userId, name: m.name })}
                >
                  <Trash2 />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          <Users className="mr-1 inline size-3.5" />
          Managers edit everything · Members create and edit tasks · Viewers only read.
        </p>
        <ConfirmDialog open={Boolean(toRemove)} onOpenChange={(o) => !o && setToRemove(null)}>
          <ConfirmDialogContent
            title="Remove member?"
            description={toRemove ? `${toRemove.name} loses access to this project.` : ""}
            confirmLabel="Remove"
            destructive
            loading={busy}
            onConfirm={() => toRemove && void removeMember(toRemove.userId)}
          />
        </ConfirmDialog>
      </CardContent>
    </Card>
  );
}

/* ------------------------------ Danger ------------------------------- */
function DangerSection({
  project,
  orgId,
  projectId,
  onDeleted,
}: {
  project: ProjectDetailDTO;
  orgId: string;
  projectId: string;
  onDeleted: () => void;
}) {
  const qc = useQueryClient();
  const [archiving, setArchiving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const toggleArchive = async () => {
    setArchiving(true);
    try {
      await apiFetch(`/api/projects/${projectId}/archive`, {
        method: "POST",
        body: JSON.stringify({ archived: project.status === "active" }),
      });
      toast.success(project.status === "active" ? "Project archived" : "Project restored");
      qc.invalidateQueries({ queryKey: qk.project(orgId, projectId) });
      qc.invalidateQueries({ queryKey: qk.projects(orgId) });
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setArchiving(false);
    }
  };

  const deleteProject = async () => {
    setDeleting(true);
    try {
      await apiFetch(`/api/projects/${projectId}`, { method: "DELETE" });
      toast.success("Project deleted");
      onDeleted();
    } catch (e) {
      toast.error(apiErrorMessage(e));
      setDeleting(false);
    }
  };

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="text-sm text-destructive">Danger zone</CardTitle>
        <CardDescription>Archiving hides the project from the active list — deleting removes it forever.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={() => void toggleArchive()} loading={archiving}>
          {project.status === "active" ? <Archive /> : <ArchiveRestore />}
          {project.status === "active" ? "Archive project" : "Restore project"}
        </Button>
        <Button variant="destructive" onClick={() => setConfirmDelete(true)} loading={deleting}>
          <Trash2 /> Delete project
        </Button>
        <ConfirmDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <ConfirmDialogContent
            title="Delete this project forever?"
            description={`${project.name} and everything inside it — tasks, comments, sprints, milestones and files — will be permanently deleted. This cannot be undone.`}
            confirmLabel="Delete forever"
            destructive
            loading={deleting}
            onConfirm={() => void deleteProject()}
          />
        </ConfirmDialog>
      </CardContent>
    </Card>
  );
}
