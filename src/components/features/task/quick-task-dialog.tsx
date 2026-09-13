"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { DatePicker } from "@/components/ui/date-picker";
import { LabelPicker, type LabelOption } from "@/components/features/task/label-picker";
import { FieldError, FormControl, FormField, FormItem, FormLabel, FormProvider } from "@/components/ui/form";
import { apiFetch } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { PRIORITY_META } from "@/components/features/task/board-utils";
import type { BoardColumnDTO, ProjectMemberDTO } from "@/types";

const schema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(300, "Keep the title under 300 characters."),
});

type Values = z.infer<typeof schema>;

export interface SprintOption {
  id: string;
  name: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
}

interface FormProps {
  projectId: string;
  orgId: string;
  status: string | null;
  statuses: BoardColumnDTO[];
  members: ProjectMemberDTO[];
  labels: LabelOption[];
  sprints: SprintOption[];
  defaultSprintId: string | null;
  onCreated?: (taskId: string) => void;
  onDone: () => void;
}

/**
 * The form is mounted per open (conditional render), so every field starts
 * from its default values without effect-based reset-on-open.
 */
function QuickTaskForm({
  projectId,
  orgId,
  status,
  statuses,
  members,
  labels,
  sprints,
  defaultSprintId,
  onCreated,
  onDone,
}: FormProps) {
  const qc = useQueryClient();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { title: "" } });
  const [taskStatus, setTaskStatus] = React.useState<string>(status ?? statuses[0]?.key ?? "");
  const [priority, setPriority] = React.useState("none");
  const [assigneeId, setAssigneeId] = React.useState<string | null>(null);
  const [dueDate, setDueDate] = React.useState<Date | null>(null);
  const [labelIds, setLabelIds] = React.useState<string[]>([]);
  const [sprintId, setSprintId] = React.useState<string>(defaultSprintId ?? "__none");

  const create = useMutation({
    mutationFn: (values: Values) =>
      apiFetch(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        body: JSON.stringify({
          title: values.title,
          status: taskStatus,
          priority: priority === "none" ? undefined : priority,
          assigneeId: assigneeId ?? undefined,
          dueDate: dueDate?.toISOString(),
          labels: labelIds.length
            ? labels.filter((l) => labelIds.includes(l.id)).map((l) => ({ id: l.id, name: l.name, color: l.color }))
            : undefined,
          sprintId: sprintId === "__none" ? undefined : sprintId,
        }),
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: qk.board(orgId, projectId) });
      qc.invalidateQueries({ queryKey: qk.tasks(orgId, projectId) });
      qc.invalidateQueries({ queryKey: qk.project(orgId, projectId) });
      toast.success("Task created");
      onDone();
      const id = (data as { task?: { id?: string } }).task?.id;
      if (id && onCreated) onCreated(id);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't create the task."),
  });

  return (
    <FormProvider {...form}>
      <form id="quick-task" onSubmit={form.handleSubmit((v) => create.mutate(v))} className="space-y-3.5">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input autoFocus placeholder="What needs to be done?" {...field} />
              </FormControl>
              <FieldError name="title" />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-3">
          <FormItem>
            <FormLabel>Status</FormLabel>
            <Select value={taskStatus} onValueChange={setTaskStatus}>
              <SelectTrigger aria-label="Status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    <span className="flex items-center gap-2">
                      <span aria-hidden className="size-2 rounded-full" style={{ background: s.color }} />
                      {s.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormItem>
          <FormItem>
            <FormLabel>Priority</FormLabel>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger aria-label="Priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PRIORITY_META) as string[]).map((p) => (
                  <SelectItem key={p} value={p}>
                    {PRIORITY_META[p].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormItem>
          <FormItem>
            <FormLabel>Assignee</FormLabel>
            <Combobox
              options={members.map((m) => ({ value: m.userId, label: m.name }))}
              value={assigneeId}
              onValueChange={setAssigneeId}
              placeholder="Unassigned"
              searchPlaceholder="Search members…"
              allowClear
            />
          </FormItem>
          <FormItem>
            <FormLabel>Due date</FormLabel>
            <DatePicker value={dueDate} onValueChange={setDueDate} placeholder="No date" />
          </FormItem>
          {sprints.length > 0 ? (
            <FormItem>
              <FormLabel>Sprint</FormLabel>
              <Select value={sprintId} onValueChange={setSprintId}>
                <SelectTrigger aria-label="Sprint">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">No sprint</SelectItem>
                  {sprints.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
          ) : null}
          <FormItem>
            <FormLabel>Labels</FormLabel>
            <LabelPicker options={labels} value={labelIds} onValueChange={setLabelIds} />
          </FormItem>
        </div>
        <DialogFooter>
          <Button variant="ghost" type="button" onClick={onDone}>
            Cancel
          </Button>
          <Button form="quick-task" type="submit" loading={create.isPending}>
            Create task
          </Button>
        </DialogFooter>
      </form>
    </FormProvider>
  );
}

export function QuickTaskDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  orgId: string;
  status: string | null;
  statuses: BoardColumnDTO[];
  members: ProjectMemberDTO[];
  labels: LabelOption[];
  sprints: SprintOption[];
  defaultSprintId: string | null;
  onCreated?: (taskId: string) => void;
}) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create task</DialogTitle>
          <DialogDescription>Add it to the board — you can edit details right after.</DialogDescription>
        </DialogHeader>
        {props.open ? (
          <QuickTaskForm {...props} onDone={() => props.onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
