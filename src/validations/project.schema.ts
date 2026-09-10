import { z } from "zod";
import { isValidHexColor } from "@/lib/utils";

export const projectKeySchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(2, "Key must be at least 2 characters.")
  .max(8, "Key must be under 8 characters.")
  .regex(/^[A-Z][A-Z0-9]*$/, "Use letters and numbers only (must start with a letter).");

export const hexColorSchema = z
  .string()
  .regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/, "Use a hex color like #8b5cf6.");

export const projectStatusSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{1,29}$/, "Status key must be lowercase (letters, numbers, underscores)."),
  label: z.string().trim().min(1, "Label is required.").max(40),
  color: hexColorSchema,
});

export const createProjectSchema = z.object({
  name: z.string().trim().min(2, "Project name is required.").max(120),
  key: projectKeySchema,
  description: z.string().trim().max(4000).optional(),
  color: hexColorSchema.optional(),
  startDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
  private: z.boolean().optional(),
  managerUserIds: z.array(z.string()).max(10).optional(),
});

export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(4000).nullable().optional(),
    color: hexColorSchema.nullable().optional(),
    startDate: z.coerce.date().nullable().optional(),
    dueDate: z.coerce.date().nullable().optional(),
    private: z.boolean().optional(),
  })
  .refine((v) => (v.startDate && v.dueDate ? v.startDate <= v.dueDate : true), {
    message: "Start date must be before due date.",
    path: ["startDate"],
  });

export const updateProjectStatusesSchema = z.object({
  statuses: z.array(projectStatusSchema).min(2, "A project needs at least two statuses.").max(12),
  /** rename/color edits only allowed for built-in keys; delete via explicit array diff */
});

export const addProjectMemberSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["manager", "member", "viewer"]).optional(),
});

export const updateProjectMemberSchema = z.object({
  role: z.enum(["manager", "member", "viewer"]),
});

export const labelInputSchema = z.object({
  id: z.string().regex(/^[a-z0-9]{4,12}$/, "Invalid label id.").optional(),
  name: z.string().trim().min(1, "Label name is required.").max(30),
  color: hexColorSchema,
});

export const projectListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  q: z.string().trim().max(100).optional(),
  status: z.enum(["active", "archived", "all"]).optional(),
  sort: z.enum(["updated", "created", "name", "dueDate"]).optional(),
});

export { isValidHexColor };
