"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Flag,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Rocket,
  SkipForward,
  Target,
  XCircle,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { useActiveOrgId } from "@/lib/hooks/use-session";
import { apiErrorMessage } from "@/components/features/error-handling";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ErrorState, EmptyState } from "@/components/ui/state";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog, ConfirmDialogContent } from "@/components/ui/confirm-dialog";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FieldError,
  FormProvider,
} from "@/components/ui/form";
import { SpriteBurnChart } from "@/components/features/project/burndown-chart";
import { formatDate, cn } from "@/lib/utils";
import { toast } from "sonner";
import type { SprintDTO, BurndownPoint } from "@/types";

const sprintSchema = z
  .object({
    name: z.string().trim().min(1, "Sprint name is required.").max(120),
    goal: z.string().trim().max(1000).optional(),
    startDate: z.date().nullable().optional(),
    endDate: z.date().nullable().optional(),
  })
  .refine((v) => !(v.startDate && v.endDate) || v.startDate <= v.endDate, {
    message: "Start must be before end.",
    path: ["startDate"],
  });
type SprintValues = z.infer<typeof sprintSchema>;

export default function SprintsPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const orgId = useActiveOrgId();
  const qc = useQueryClient();
  const router = useRouter();

  const sprints = useQuery({
    queryKey: qk.sprints(orgId ?? "x", projectId),
    queryFn: () =>
      apiFetch<{ sprints: SprintDTO[] }>(`/api/projects/${projectId}/sprints?orgId=${orgId}`),
    enabled: Boolean(orgId),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: qk.sprints(orgId ?? "x", projectId) });
    qc.invalidateQueries({ queryKey: qk.project(orgId ?? "x", projectId) });
  };
  const act = useMutation({
    mutationFn: ({ sprintId, action }: { sprintId: string; action: "start" | "complete" | "cancel" }) =>
      apiFetch(`/api/projects/${projectId}/sprints/${sprintId}/${action}`, { method: "POST" }),
    onSuccess: invalidate,
    onError: (e) => toast.error(apiErrorMessage(e, "Couldn't update the sprint.")),
  });
  const removeSprint = useMutation({
    mutationFn: (sprintId: string) =>
      apiFetch(`/api/projects/${projectId}/sprints/${sprintId}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidate();
      toast.success("Sprint deleted");
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const [editor, setEditor] = React.useState<{ open: boolean; sprint: SprintDTO | null }>({ open: false, sprint: null });
  const [toDelete, setToDelete] = React.useState<SprintDTO | null>(null);

  const all = sprints.data?.sprints ?? [];
  const active = all.filter((s) => s.status === "active");
  const planned = all.filter((s) => s.status === "planned");
  const done = all.filter((s) => s.status === "completed" || s.status === "cancelled");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Sprints</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Iterations with goals, dates and burndown tracking.
          </p>
        </div>
        <Button onClick={() => setEditor({ open: true, sprint: null })}>
          <Plus /> New sprint
        </Button>
      </div>

      {sprints.isLoading ? (
        <div className="space-y-3">
          <CardSkeleton className="h-20" />
          <CardSkeleton className="h-64" />
        </div>
      ) : sprints.isError ? (
        <ErrorState title="Couldn't load sprints" message={apiErrorMessage(sprints.error)} onRetry={() => void sprints.refetch()} />
      ) : all.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No sprints yet"
          description="Plan your first iteration with a name, goal and dates — then pull tasks onto it from the board."
          action={<Button onClick={() => setEditor({ open: true, sprint: null })}><Plus /> Create sprint</Button>}
        />
      ) : (
        <div className="space-y-6">
          {active.length > 0 ? (
            <section aria-label="Active sprints">
              {active.map((s) => (
                <SprintCard key={s.id} sprint={s} expanded onAct={(a) => act.mutate({ sprintId: s.id, action: a })} onEdit={() => setEditor({ open: true, sprint: s })} onDelete={() => setToDelete(s)} orgId={orgId} projectId={projectId} />
              ))}
            </section>
          ) : null}
          {planned.length > 0 ? (
            <section aria-label="Planned sprints">
              <h2 className="mb-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                Planned · {planned.length}
              </h2>
              <div className="space-y-3">
                {planned.map((s) => (
                  <SprintCard key={s.id} sprint={s} onAct={(a) => act.mutate({ sprintId: s.id, action: a })} onEdit={() => setEditor({ open: true, sprint: s })} onDelete={() => setToDelete(s)} orgId={orgId} projectId={projectId} />
                ))}
              </div>
            </section>
          ) : null}
          {done.length > 0 ? (
            <section aria-label="Completed sprints">
              <h2 className="mb-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                Completed & cancelled · {done.length}
              </h2>
              <div className="space-y-3">
                {done.map((s) => (
                  <SprintCard key={s.id} sprint={s} onAct={() => undefined} onEdit={() => setEditor({ open: true, sprint: s })} onDelete={() => setToDelete(s)} orgId={orgId} projectId={projectId} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}

      {editor.open ? (
        <SprintEditor
          projectId={projectId}
          orgId={orgId ?? ""}
          sprint={editor.sprint}
          onClose={() => setEditor({ open: false, sprint: null })}
          onSaved={() => {
            setEditor({ open: false, sprint: null });
            invalidate();
          }}
        />
      ) : null}

      <ConfirmDialog open={Boolean(toDelete)} onOpenChange={(o) => !o && setToDelete(null)}>
        <ConfirmDialogContent
          title="Delete sprint?"
          description={toDelete ? `“${toDelete.name}” will be removed. Tasks stay on the board but lose their sprint link.` : ""}
          confirmLabel="Delete sprint"
          destructive
          loading={removeSprint.isPending}
          onConfirm={() => toDelete && removeSprint.mutate(toDelete.id)}
        />
      </ConfirmDialog>
    </div>
  );
}

function SprintCard({
  sprint: s,
  expanded,
  onAct,
  onEdit,
  onDelete,
  orgId,
  projectId,
}: {
  sprint: SprintDTO;
  expanded?: boolean;
  onAct: (a: "start" | "complete" | "cancel") => void;
  onEdit: () => void;
  onDelete: () => void;
  orgId: string | null;
  projectId: string;
}) {
  const router = useRouter();
  const [showChart, setShowChart] = React.useState(Boolean(expanded));
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const pct = s.taskCount ? Math.round((s.completedTaskCount / s.taskCount) * 100) : 0;

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span
          aria-hidden
          className={cn(
            "flex size-8 items-center justify-center rounded-md",
            s.status === "active" ? "bg-primary/15 text-primary" : s.status === "completed" ? "bg-success/15 text-success" : s.status === "cancelled" ? "bg-muted text-muted-foreground" : "bg-secondary text-muted-foreground"
          )}
        >
          {s.status === "active" ? <Rocket className="size-4" /> : s.status === "completed" ? <Flag className="size-4" /> : s.status === "cancelled" ? <XCircle className="size-4" /> : <Target className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{s.name}</h3>
            <Badge variant={s.status === "active" ? "default" : "muted"} className="capitalize">{s.status}</Badge>
          </div>
          {s.goal ? <p className="mt-0.5 line-clamp-1 text-[13px] text-muted-foreground">{s.goal}</p> : null}
          <p className="mt-0.5 text-xs text-muted-foreground">
            {s.startDate ? formatDate(s.startDate) : "Open start"} → {s.endDate ? formatDate(s.endDate) : "Open end"} ·{" "}
            {s.taskCount} tasks · {s.completedTaskCount} done
            {s.totalPoints ? ` · ${s.totalPoints} pts` : ""}
          </p>
        </div>
        {s.status === "active" || s.status === "completed" ? (
          <button
            type="button"
            onClick={() => setShowChart((v) => !v)}
            className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-expanded={showChart}
          >
            {showChart ? "Hide burndown" : "Burndown"}
          </button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${s.name}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {s.status === "planned" ? (
              <DropdownMenuItem onSelect={() => onAct("start")}>
                <Play /> Start sprint
              </DropdownMenuItem>
            ) : null}
            {s.status === "active" ? (
              <DropdownMenuItem onSelect={() => onAct("complete")}>
                <Flag /> Complete sprint
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil /> Edit details
            </DropdownMenuItem>
            {s.status === "planned" ? (
              <>
                <DropdownMenuItem danger onSelect={() => setCancelOpen(true)}>
                  <SkipForward /> Cancel sprint
                </DropdownMenuItem>
                <DropdownMenuItem danger onSelect={onDelete}>
                  <XCircle /> Delete sprint
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {s.status === "active" && s.taskCount > 0 ? (
        <div className="mt-3 flex items-center gap-2 text-xs">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-muted-foreground">{pct}% complete</span>
        </div>
      ) : null}

      {showChart && (s.status === "active" || s.status === "completed") ? (
        <div className="mt-3 border-t pt-3">
          <BurndownSection sprintId={s.id} projectId={projectId} orgId={orgId} key={s.id} />
        </div>
      ) : null}

      <ConfirmDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <ConfirmDialogContent
          title="Cancel sprint?"
          description="Tasks in the sprint stay on the board and move back to the backlog."
          confirmLabel="Cancel sprint"
          onConfirm={() => {
            onAct("cancel");
            setCancelOpen(false);
          }}
        />
      </ConfirmDialog>
    </Card>
  );
}

function BurndownSection({ sprintId, projectId, orgId }: { sprintId: string; projectId: string; orgId: string | null }) {
  const chart = useQuery({
    queryKey: ["sprint-burndown", orgId, projectId, sprintId],
    queryFn: () =>
      apiFetch<{ points: BurndownPoint[]; total: number }>(
        `/api/projects/${projectId}/sprints/${sprintId}/burndown?days=30`
      ),
    enabled: Boolean(orgId),
  });
  if (chart.isLoading) return <div className="h-36 animate-pulse rounded bg-secondary/60" />;
  if (chart.isError || !chart.data?.points.length)
    return <p className="py-4 text-center text-xs text-muted-foreground">Not enough data for a burndown yet.</p>;
  return <SpriteBurnChart points={chart.data.points} total={chart.data.total} />;
}

function SprintEditor({
  projectId,
  orgId,
  sprint,
  onClose,
  onSaved,
}: {
  projectId: string;
  orgId: string;
  sprint: SprintDTO | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const form = useForm<SprintValues>({
    resolver: zodResolver(sprintSchema),
    defaultValues: {
      name: sprint?.name ?? "",
      goal: sprint?.goal ?? "",
      startDate: sprint?.startDate ? new Date(sprint.startDate) : null,
      endDate: sprint?.endDate ? new Date(sprint.endDate) : null,
    },
  });
  const [saving, setSaving] = React.useState(false);

  const submit = async (values: SprintValues) => {
    setSaving(true);
    try {
      const payload = {
        name: values.name,
        goal: values.goal || undefined,
        startDate: values.startDate?.toISOString(),
        endDate: values.endDate?.toISOString(),
      };
      if (sprint) {
        await apiFetch(`/api/projects/${projectId}/sprints/${sprint.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success("Sprint updated");
      } else {
        await apiFetch(`/api/projects/${projectId}/sprints`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("Sprint created");
      }
      onSaved();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{sprint ? "Edit sprint" : "New sprint"}</DialogTitle>
          <DialogDescription>
            Set a name and goal. You can start it once tasks are ready — until then it stays planned.
          </DialogDescription>
        </DialogHeader>
        <FormProvider {...form}>
          <form id="sprint-form" onSubmit={form.handleSubmit(submit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sprint name</FormLabel>
                  <FormControl>
                    <Input autoFocus placeholder="e.g. Sprint 12 — checkout flow" {...field} />
                  </FormControl>
                  <FieldError name="name" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="goal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Goal</FormLabel>
                  <FormControl>
                    <Textarea placeholder="What should this sprint deliver?" rows={3} {...field} value={field.value ?? ""} />
                  </FormControl>
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start date</FormLabel>
                    <FormControl>
                      <DatePicker value={field.value ?? null} onValueChange={field.onChange} placeholder="Not set" />
                    </FormControl>
                    <FieldError name="startDate" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End date</FormLabel>
                    <FormControl>
                      <DatePicker value={field.value ?? null} onValueChange={field.onChange} placeholder="Not set" />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </form>
        </FormProvider>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button form="sprint-form" type="submit" loading={saving}>{sprint ? "Save changes" : "Create sprint"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
