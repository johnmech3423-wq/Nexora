import { z } from "zod";
import { TASK_PRIORITIES } from "@/lib/constants";

export const taskTitleSchema = z.string().trim().min(1, "Title is required.").max(300);

export const createTaskSchema = z.object({
  title: taskTitleSchema,
  description: z.string().trim().max(20_000).optional().default(""),
  status: z.string().min(1).max(40).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  startDate: z.coerce.date().nullable().optional(),
  estimateMin: z.coerce.number().int().min(0).max(525600).nullable().optional(),
  labels: z.array(z.object({ id: z.string(), name: z.string().max(30), color: z.string() })).max(20).optional(),
  parentId: z.string().nullable().optional(),
  sprintId: z.string().nullable().optional(),
  milestoneId: z.string().nullable().optional(),
});

export const updateTaskSchema = z
  .object({
    title: taskTitleSchema.optional(),
    description: z.string().trim().max(20_000).nullable().optional(),
    status: z.string().min(1).max(40).optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    assigneeId: z.string().nullable().optional(),
    dueDate: z.coerce.date().nullable().optional(),
    startDate: z.coerce.date().nullable().optional(),
    estimateMin: z.coerce.number().int().min(0).max(525600).nullable().optional(),
    labels: z.array(z.object({ id: z.string(), name: z.string().max(30), color: z.string() })).max(20).optional(),
    parentId: z.string().nullable().optional(),
    sprintId: z.string().nullable().optional(),
    milestoneId: z.string().nullable().optional(),
    watchers: z.array(z.string()).max(200).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update." })
  .refine((v) => (v.startDate && v.dueDate ? v.startDate <= v.dueDate : true), {
    message: "Start date must be before due date.",
    path: ["startDate"],
  });

export const moveTaskSchema = z.object({
  status: z.string().min(1).max(40),
  /** position within the column (0-based, from top) — server resolves to order */
  position: z.coerce.number().int().min(0).max(10_000),
});

export const reorderBoardSchema = z.object({
  updates: z
    .array(
      z.object({
        taskId: z.string(),
        status: z.string().min(1).max(40),
        order: z.number().min(-1e12).max(1e12), // client sends fractional order for instant persistence
      })
    )
    .min(1)
    .max(200),
});

export const setTaskOrderSchema = z.object({
  order: z.number().min(-1e12).max(1e12),
});

export const taskQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  q: z.string().trim().max(150).optional(),
  status: z.string().max(40).optional(),
  statuses: z.array(z.string().max(40)).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  assigneeId: z.string().optional(),
  reporterId: z.string().optional(),
  labelId: z.string().optional(),
  sprintId: z.string().optional(),
  milestoneId: z.string().optional(),
  parentId: z.string().nullable().optional(),
  due: z.enum(["overdue", "today", "week", "none"]).optional(),
  sort: z.enum(["updated", "created", "dueDate", "priority", "number"]).optional(),
});

export const addCommentSchema = z.object({
  body: z.string().trim().min(1, "Comment cannot be empty.").max(20_000),
  parentId: z.string().nullable().optional(),
});

export const updateCommentSchema = z.object({
  body: z.string().trim().min(1, "Comment cannot be empty.").max(20_000),
});

export const commentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
});

export const toggleReactionSchema = z.object({
  emoji: z
    .string()
    .min(1)
    .max(16)
    .regex(/^(\p{Emoji}|[\u2600-\u27BF]|:[\w+-]+:)+$/u, "Not a valid emoji."),
});
