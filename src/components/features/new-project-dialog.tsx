"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FieldError,
  FormProvider,
} from "@/components/ui/form";
import { apiFetch } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

const schema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters.").max(120, "Keep the name under 120 characters."),
    key: z
      .string()
      .trim()
      .toUpperCase()
      .min(2, "Key must be at least 2 characters.")
      .max(8, "Key must be under 8 characters.")
      .regex(/^[A-Z][A-Z0-9]*$/, "Letters and numbers only, starting with a letter."),
    description: z.string().trim().max(4000).optional(),
    startDate: z.date().nullable().optional(),
    dueDate: z.date().nullable().optional(),
  })
  .refine((v) => !(v.startDate && v.dueDate) || v.startDate <= v.dueDate, {
    message: "Start date must be before the due date.",
    path: ["startDate"],
  });

type Values = z.infer<typeof schema>;

const SWATCHES = ["#8b5cf6", "#3b82f6", "#06b6d4", "#10b981", "#84cc16", "#f59e0b", "#ef4444", "#ec4899", "#64748b"];

export function NewProjectDialog({
  orgId,
  trigger,
}: {
  orgId: string;
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [color, setColor] = React.useState<string>(SWATCHES[0]);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", key: "", description: "", startDate: null, dueDate: null },
  });

  const create = useMutation({
    mutationFn: (values: Values & { color: string }) =>
      apiFetch<{ project: { id: string } }>(
        `/api/projects?orgId=${encodeURIComponent(orgId)}`,
        {
          method: "POST",
          body: JSON.stringify({
            name: values.name,
            key: values.key,
            description: values.description || undefined,
            color: values.color,
            startDate: values.startDate?.toISOString(),
            dueDate: values.dueDate?.toISOString(),
          }),
        }
      ),
    onSuccess: async (data) => {
      qc.invalidateQueries({ queryKey: qk.projects(orgId) });
      toast.success("Project created");
      setOpen(false);
      router.push(`/projects/${data.project.id}`);
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "Could not create the project.";
      toast.error(msg);
      const fe = (e as { fieldErrors?: Record<string, string[]> }).fieldErrors;
      if (fe) {
        for (const [field, msgs] of Object.entries(fe)) {
          if (msgs?.[0] && field in form.getValues()) {
            (form as unknown as { setError: (f: string, e: { message: string }) => void }).setError(field, {
              message: msgs[0],
            });
          }
        }
      }
    },
  });

  const onSubmit = (values: Values) => create.mutate({ ...values, color });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button>New project</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create a project</DialogTitle>
          <DialogDescription>
            Projects group tasks, sprints and files around one goal. You&apos;ll be the manager.
          </DialogDescription>
        </DialogHeader>
        <FormProvider {...form}>
          <form id="new-project" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input autoFocus placeholder="e.g. Website Redesign" {...field} />
                  </FormControl>
                  <FieldError name="name" />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="key"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Key{" "}
                      <span className="font-normal text-muted-foreground">
                        (shows on tasks, e.g. NEX-1)
                      </span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="WEB" maxLength={8} className="font-mono uppercase" {...field} />
                    </FormControl>
                    <FieldError name="key" />
                  </FormItem>
                )}
              />
              <FormItem>
                <FormLabel>Color</FormLabel>
                <div role="radiogroup" aria-label="Project color" className="flex flex-wrap gap-1.5 pt-1">
                  {SWATCHES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={color === c}
                      aria-label={`Color ${c}`}
                      onClick={() => setColor(c)}
                      className={cn(
                        "size-6 rounded-full ring-offset-2 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        color === c && "ring-2 ring-foreground"
                      )}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </FormItem>
            </div>
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="What is this project about?" rows={3} {...field} />
                  </FormControl>
                  <FieldError name="description" />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start date</FormLabel>
                    <FormControl>
                      <DatePicker
                        value={field.value ?? null}
                        onValueChange={(d) => field.onChange(d)}
                        placeholder="Optional"
                      />
                    </FormControl>
                    <FieldError name="startDate" />
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
                      <DatePicker
                        value={field.value ?? null}
                        onValueChange={(d) => field.onChange(d)}
                        placeholder="Optional"
                      />
                    </FormControl>
                    <FieldError name="dueDate" />
                  </FormItem>
                )}
              />
            </div>
            <FormDescription className="!mt-2">
              You can add members and custom statuses later from project settings.
            </FormDescription>
          </form>
        </FormProvider>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button form="new-project" type="submit" loading={create.isPending}>
            Create project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
