import { z } from "zod";
import { categories } from "@/lib/format";
import { expenseStatuses } from "@/lib/trip-permissions";

export const idSchema = z.string().trim().min(1).max(128);

export const dateStringSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value) => {
      const [year, month, day] = value.split("-").map(Number);
      const parsed = new Date(Date.UTC(year, month - 1, day));
      return (
        parsed.getUTCFullYear() === year &&
        parsed.getUTCMonth() === month - 1 &&
        parsed.getUTCDate() === day
      );
    },
    { message: "Invalid date." }
  );

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""))
    .transform((value) => value || undefined);

export const registerSchema = z
  .object({
    username: z.string().trim().min(3).max(80),
    email: z.email().trim().toLowerCase().max(120),
    password: z.string().min(8).max(128),
    confirmPassword: z.string().min(8).max(128)
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords must match.",
    path: ["confirmPassword"]
  });

export const loginSchema = z.object({
  email: z.email().trim().toLowerCase().max(120),
  password: z.string().max(128).optional(),
  twoFactorCode: z
    .string()
    .trim()
    .max(12)
    .optional()
    .or(z.literal(""))
    .transform((value) => value || undefined),
  loginToken: z
    .string()
    .trim()
    .max(256)
    .optional()
    .or(z.literal(""))
    .transform((value) => value || undefined)
});

export const forgotPasswordSchema = z.object({
  email: z.email().trim().toLowerCase().max(120)
});

export const adminInvitationSchema = z.object({
  email: z.email().trim().toLowerCase().max(120),
  displayName: optionalText(120),
  role: z.enum(["user", "readonly"]).optional().default("user")
});

export const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(32).max(256),
    password: z.string().min(8).max(128),
    confirmPassword: z.string().min(8).max(128)
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords must match.",
    path: ["confirmPassword"]
  });

export const accountProfileSchema = z.object({
  username: z.string().trim().min(3).max(80),
  email: z.email().trim().toLowerCase().max(120)
});

export const accountPasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    password: z.string().min(8).max(128),
    confirmPassword: z.string().min(8).max(128)
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords must match.",
    path: ["confirmPassword"]
  });

export const verificationTokenSchema = z.string().trim().min(32).max(256);

export const acceptInvitationSchema = z
  .object({
    token: z.string().trim().min(32).max(256),
    username: z.string().trim().min(3).max(80),
    password: z.string().min(8).max(128),
    confirmPassword: z.string().min(8).max(128)
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords must match.",
    path: ["confirmPassword"]
  });

export const twoFactorCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/)
});

export const tripSchema = z
  .object({
    name: z.string().trim().min(1).max(140),
    destination: optionalText(140),
    startDate: dateStringSchema
      .optional()
      .or(z.literal(""))
      .transform((value) => value || undefined),
    endDate: dateStringSchema
      .optional()
      .or(z.literal(""))
      .transform((value) => value || undefined)
  })
  .refine(
    (data) =>
      !data.startDate ||
      !data.endDate ||
      new Date(`${data.endDate}T00:00:00`) >= new Date(`${data.startDate}T00:00:00`),
    {
      message: "End date must be on or after start date.",
      path: ["endDate"]
    }
  );

export const participantSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z
    .email()
    .trim()
    .toLowerCase()
    .max(120)
    .optional()
    .or(z.literal(""))
    .transform((value) => value || undefined)
});

export const expenseSchema = z.object({
  title: z.string().trim().min(1).max(140),
  amount: z.coerce.number().positive().max(1_000_000),
  category: z.enum(categories),
  payerId: idSchema,
  date: dateStringSchema,
  status: z.enum(expenseStatuses).optional().default("submitted"),
  notes: optionalText(500),
  sharedParticipantIds: z.array(idSchema).optional().default([])
});

export type ExpenseFormData = z.infer<typeof expenseSchema>;

const tripPaymentAmountSchema = z
  .string()
  .trim()
  .regex(/^\d{1,7}(?:[.,]\d{1,2})?$/, {
    message: "Enter an amount with no more than two decimal places."
  })
  .transform((value) => Number(value.replace(",", ".")))
  .refine((value) => Number.isFinite(value) && value > 0 && value <= 1_000_000, {
    message: "Amount must be between 0.01 and 1,000,000.00."
  });

export const tripPaymentConfirmationSchema = z
  .object({
    senderParticipantId: idSchema,
    recipientParticipantId: idSchema,
    amount: tripPaymentAmountSchema,
    date: dateStringSchema,
    note: optionalText(500)
  })
  .refine((data) => data.senderParticipantId !== data.recipientParticipantId, {
    message: "Paid by and paid to must be different participants.",
    path: ["recipientParticipantId"]
  });

export type TripPaymentConfirmationData = z.infer<typeof tripPaymentConfirmationSchema>;

export const tripPaymentEditSchema = z.object({
  date: dateStringSchema,
  note: optionalText(500)
});

export type TripPaymentEditData = z.infer<typeof tripPaymentEditSchema>;

export function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export function parseDateInput(value?: string) {
  return value ? new Date(`${value}T00:00:00`) : null;
}
