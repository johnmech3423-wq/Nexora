"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { CalendarClock, Flag, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { useActiveOrgId } from "@/lib/hooks/use-session";
import { apiErrorMessage } from "@/components/features/error-handling";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/controls";
import { EmptyState, ErrorState } from "@/components/ui/state";
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
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import type { MilestoneDTO, ProjectDetailDTO } from "@/types";

const schema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(120),
  description: z.string().trim().max(2000).optional(),
  dueDate: z.date().nullable().optional(),
});
type Values = z.infer<typeof schema>;

const STATUS_META: Record<string, { label: string; cls: string }> = {
  completed: { label: "Completed", cls: "bg-success/15 text-success" },
  active: { label: "In progress", cls: "bg-primary/15 text-primary" },
  planned: { label: "Planned", cls: "bg-secondary text-muted-foreground" },
  overdue: { label: "Overdue", cls: "bg-destructive/15 text-destructive" },
};

export default function MilestonesPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const orgId = useActiveOrgId();
  const qc = useQueryClient();

  const detail = useQuery({
    queryKey: qk.project(orgId ?? "x", projectId),
    queryFn: () => apiFetch<{ project: ProjectDetailDTO }>(`/api/projects/${projectId}?orgId=${orgId}`),
    enabled: Boolean(orgId),
  });
  const milestones = useQuery({
    queryKey: qk.milestones(orgId ?? "x", projectId),
    queryFn: () => apiFetch<{ milestones: MilestoneDTO[] }>(`/api/projects/${projectId}/milestones?orgId=${orgId}`),
    enabled: Boolean(orgId),
  });

  const isManager = detail.data?.project.myRole === "manager";
  const [editor, setEditor] = React.useState<{ open: boolean; milestone: MilestoneDTO | null }>({ open: false, milestone: null });
  const [toDelete, setToDelete] = React.useState<MilestoneDTO | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: qk.milestones(orgId ?? "x", projectId) });
    qc.invalidateQueries({ queryKey: qk.project(orgId ?? "x", projectId) });
  };

  const remove = async (m: MilestoneDTO) => {
    setDeleting(true);
    try {
      await apiFetch(`/api/projects/${projectId}/milestones/${m.id}`, { method: "DELETE" });
      toast.success("Milestone deleted");
      invalidate();
      setToDelete(null);
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setDeleting(false);
    }
  };

  const list = milestones.data?.milestones ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Milestones</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Big checkpoints that group tasks across sprints. Progress updates as tasks move to Done.
          </p>
        </div>
        {isManager ? (
          <Button onClick={() => setEditor({ open: true, milestone: null })}>
            <Plus /> New milestone
          </Button>
        ) : null}
      </div>

      {milestones.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => <CardSkeleton key={i} className="h-44" />)}
        </div>
      ) : milestones.isError ? (
        <ErrorState title="Couldn't load milestones" message={apiErrorMessage(milestones.error)} onRetry={() => void milestones.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={Flag}
          title="No milestones yet"
          description="Milestones group work into named checkpoints — e.g. “Beta launch ready” — with automatic progress."
          action={isManager ? <Button onClick={() => setEditor({ open: true, milestone: null })}><Plus /> Create milestone</Button> : undefined}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((m) => {
            const meta = STATUS_META[m.status] ?? STATUS_META.planned;
            return (
              <Card key={m.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold break-words">{m.name}</h3>
                    <div className="mt-1">
                      <Badge className={meta.cls}>{meta.label}</Badge>
                    </div>
                  </div>
                  {isManager ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${m.name}`}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setEditor({ open: true, milestone: m })}>
                          <Pencil /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem danger onSelect={() => setToDelete(m)}>
                          <Trash2 /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </div>
                {m.description ? (
                  <p className="line-clamp-2 text-[13px] leading-snug text-muted-foreground">{m.description}</p>
                ) : null}
                <div className="mt-auto space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {m.completedTaskCount}/{m.taskCount} tasks
                    </span>
                    <span className="tabular-nums">{m.progress}%</span>
                  </div>
                  <Progress value={m.progress} className="h-1.5" />
                  <p className="flex items-center gap-1 pt-1 text-[11px] text-muted-foreground">
                    {m.dueDate ? (
                      <>
                        <CalendarClock className="size-3" /> Due {formatDate(m.dueDate)}
                      </>
                    ) : (
                      "No due date"
                    )}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {editor.open ? (
        <MilestoneEditor
          projectId={projectId}
          milestone={editor.milestone}
          onClose={() => setEditor({ open: false, milestone: null })}
          onSaved={() => {
            setEditor({ open: false, milestone: null });
            invalidate();
          }}
        />
      ) : null}

      <ConfirmDialog open={Boolean(toDelete)} onOpenChange={(o) => !o && setToDelete(null)}>
        <ConfirmDialogContent
          title="Delete milestone?"
          description={toDelete ? `“${toDelete.name}” will be removed. Tasks keep their milestone link removed.` : ""}
          confirmLabel="Delete milestone"
          destructive
          loading={deleting}
          onConfirm={() => toDelete && void remove(toDelete)}
        />
      </ConfirmDialog>
    </div>
  );
}

function MilestoneEditor({
  projectId,
  milestone,
  onClose,
  onSaved,
}: {
  projectId: string;
  milestone: MilestoneDTO | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: milestone?.name ?? "",
      description: milestone?.description ?? "",
      dueDate: milestone?.dueDate ? new Date(milestone.dueDate) : null,
    },
  });
  const [saving, setSaving] = React.useState(false);

  const submit = async (values: Values) => {
    setSaving(true);
    try {
      const payload = {
        name: values.name,
        description: values.description || undefined,
        dueDate: values.dueDate?.toISOString(),
      };
      if (milestone) {
        await apiFetch(`/api/projects/${projectId}/milestones/${milestone.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success("Milestone updated");
      } else {
        await apiFetch(`/api/projects/${projectId}/milestones`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("Milestone created");
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
          <DialogTitle>{milestone ? "Edit milestone" : "New milestone"}</DialogTitle>
          <DialogDescription>
            Link tasks to this milestone from the board — progress is computed automatically.
          </DialogDescription>
        </DialogHeader>
        <FormProvider {...form}>
          <form id="milestone-form" onSubmit={form.handleSubmit(submit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input autoFocus placeholder="e.g. Beta launch ready" {...field} />
                  </FormControl>
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
                    <Textarea rows={3} placeholder="What marks this milestone?" {...field} value={field.value ?? ""} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Due date</FormLabel>
                  <FormControl>
                    <DatePicker value={field.value ?? null} onValueChange={field.onChange} placeholder="No due date" />
                  </FormControl>
                </FormItem>
              )}
            />
          </form>
        </FormProvider>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button form="milestone-form" type="submit" loading={saving}>
            {milestone ? "Save changes" : "Create milestone"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
