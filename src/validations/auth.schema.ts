import { z } from "zod";

export const nameSchema = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters.")
  .max(80, "Name must be under 80 characters.")
  .regex(/^[^\n]+$/, "Name cannot contain line breaks.");

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address.")
  .max(254, "Email is too long.");

/** 8–72 chars with at least one letter and one number. */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password must be under 72 characters.")
  .regex(/[a-zA-Z]/, "Password must include at least one letter.")
  .regex(/[0-9]/, "Password must include at least one number.");

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  remember: z.boolean().optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
  remember: z.boolean().optional(),
});

export const twoFactorLoginSchema = z.object({
  code: z.string().min(6, "Enter the 6-digit code from your authenticator app.").max(10),
  challenge: z.string().min(10, "Invalid challenge."),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(10, "Invalid verification link."),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10, "Invalid reset link."),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password."),
  newPassword: passwordSchema,
});

export const enableTwoFactorSchema = z.object({
  code: z.string().min(6).max(10),
  secret: z.string().length(32, "Invalid secret."),
});

export const disableTwoFactorSchema = z.object({
  code: z.string().min(6).max(10),
});

export const verifyTotpCodeSchema = z.object({
  code: z.string().min(6).max(10),
});

export const updateProfileSchema = z.object({
  name: nameSchema.optional(),
  avatarUrl: z
    .string()
    .max(1000)
    .nullable()
    .refine((v) => v === null || v.startsWith("/") || /^https?:\/\//.test(v), "Avatar URL must be a valid URL.")
    .optional(),
});

export const updateNotificationPrefsSchema = z.object({
  emailEnabled: z.boolean(),
  inAppEnabled: z.boolean(),
  topics: z.record(z.string(), z.boolean()).optional(),
});

export const updatePasswordFromSettingsSchema = changePasswordSchema;
