import { z } from "zod";

export const createSprintSchema = z.object({
  name: z.string().trim().min(1, "Sprint name is required.").max(120),
  goal: z.string().trim().max(1000).optional(),
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
});

export const updateSprintSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    goal: z.string().trim().max(1000).nullable().optional(),
    startDate: z.coerce.date().nullable().optional(),
    endDate: z.coerce.date().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update." })
  .refine((v) => (v.startDate && v.endDate ? v.startDate <= v.endDate : true), {
    message: "Start date must be before end date.",
    path: ["startDate"],
  });

export const setSprintTasksSchema = z.object({
  taskIds: z.array(z.string()).max(500),
});

export const createMilestoneSchema = z.object({
  name: z.string().trim().min(2, "Milestone name is required.").max(120),
  description: z.string().trim().max(2000).optional(),
  dueDate: z.coerce.date().nullable().optional(),
});

export const updateMilestoneSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    dueDate: z.coerce.date().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update." });
