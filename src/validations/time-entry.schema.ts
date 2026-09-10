import { z } from "zod";

export const manualTimeEntrySchema = z.object({
  description: z.string().trim().max(500).optional().default(""),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
});

export const timerStartSchema = z.object({
  description: z.string().trim().max(500).optional().default(""),
});

export const timeQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  userId: z.string().optional(),
  projectId: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  taskId: z.string().optional(),
});
