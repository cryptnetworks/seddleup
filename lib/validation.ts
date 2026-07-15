import { z } from "zod";
import { categories } from "@/lib/format";
import { parseUsdMoney, type UsdMoney } from "@/lib/money";
import { expenseStatuses } from "@/lib/trip-permissions";

export const idSchema = z.string().trim().min(1).max(128);

export const dateStringSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => !Number.isNaN(new Date(`${value}T00:00:00`).getTime()), {
    message: "Invalid date."
  });

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

export function usdMoneyInputSchema(options: { allowZero?: boolean } = {}) {
  return z.string().transform((value, context): UsdMoney => {
    const parsed = parseUsdMoney(value, options);
    if (!parsed.ok) {
      context.addIssue({
        code: "custom",
        message: parsed.message,
        params: { reason: parsed.error }
      });
      return z.NEVER;
    }
    return parsed.value;
  });
}

export const positiveUsdMoneySchema = usdMoneyInputSchema();
export const optionalUsdMoneySchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.union([z.literal(""), usdMoneyInputSchema({ allowZero: true })]))
  .transform((value) => (value === "" ? null : value));

export const expenseSchema = z.object({
  title: z.string().trim().min(1).max(140),
  amount: positiveUsdMoneySchema,
  category: z.enum(categories),
  payerId: idSchema,
  date: dateStringSchema,
  status: z.enum(expenseStatuses).optional().default("submitted"),
  notes: optionalText(500),
  sharedParticipantIds: z.array(idSchema).optional().default([])
});

export const receiptReviewSchema = z.object({
  merchant: z
    .string()
    .trim()
    .max(120)
    .transform((value) => value || null),
  receiptDate: dateStringSchema
    .optional()
    .or(z.literal(""))
    .transform((value) => value || undefined),
  subtotal: optionalUsdMoneySchema,
  tax: optionalUsdMoneySchema,
  tip: optionalUsdMoneySchema,
  total: optionalUsdMoneySchema,
  status: z.enum(["needs_review", "ready"]),
  splitMode: z.enum(["simple", "itemized"])
});

export type ExpenseFormData = z.infer<typeof expenseSchema>;

export function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export function parseDateInput(value?: string) {
  return value ? new Date(`${value}T00:00:00`) : null;
}
