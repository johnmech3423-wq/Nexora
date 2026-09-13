import { z } from "zod";
import { ORG_ROLES, ORG_SLUG_PATTERN } from "@/lib/constants";

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Slug must be at least 3 characters.")
  .max(40, "Slug must be under 40 characters.")
  .regex(ORG_SLUG_PATTERN, "Use lowercase letters, numbers and dashes only (no leading/trailing dash).");

export const orgNameSchema = z.string().trim().min(2, "Organization name is required.").max(80, "Keep the name under 80 characters.");

export const createOrgSchema = z.object({
  name: orgNameSchema,
  slug: slugSchema.optional(),
  description: z.string().trim().max(400, "Description must be under 400 characters.").optional(),
});

export const updateOrgSchema = z.object({
  name: orgNameSchema.optional(),
  description: z.string().trim().max(400).nullable().optional(),
});

export const updateOrgSettingsSchema = z.object({
  restrictProjectVisibility: z.boolean().optional(),
  allowMemberProjects: z.boolean().optional(),
  allowMemberChannels: z.boolean().optional(),
});

export const updateRoleSchema = z.object({
  role: z.enum(ORG_ROLES, { message: "Invalid role." }),
});

export const updateMemberStatusSchema = z.object({
  status: z.enum(["active", "suspended"], { message: "Invalid status." }),
});

/** PATCH body for /members/[userId]: exactly one of role | status. */
export const updateMemberSchema = z
  .object({
    role: z.enum(ORG_ROLES, { message: "Invalid role." }).optional(),
    status: z.enum(["active", "suspended"], { message: "Invalid status." }).optional(),
  })
  .refine((b) => (b.role !== undefined) !== (b.status !== undefined), {
    message: "Send exactly one of: role or status.",
  });

export const inviteSchema = z.object({
  emails: z
    .array(z.string().trim().toLowerCase().email("Enter a valid email address."))
    .min(1, "Add at least one email address.")
    .max(20, "You can invite up to 20 people at once."),
  role: z.enum(ORG_ROLES, { message: "Invalid role." }),
  message: z.string().trim().max(500).optional(),
});

export const inviteRoleSchema = z.object({
  role: z.enum(ORG_ROLES, { message: "Invalid role." }),
});
