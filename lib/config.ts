import { z } from "zod";

const optionalBooleanString = z
  .string()
  .optional()
  .transform((value) => value === "true");

export const appConfigSchema = z
  .object({
    nodeEnv: z.enum(["development", "test", "production"]).default("development"),
    databaseUrl: z
      .string()
      .min(1)
      .refine(
        (value) => value.startsWith("file:"),
        "DATABASE_URL must use file:. SQLite is the only supported database engine."
      ),
    nextAuthUrl: z.url(),
    tokenDigestSecret: z.string().min(24),
    authConfigEncryptionKey: z.string().min(24).optional(),
    smtpEnabled: optionalBooleanString,
    smtpHost: z.string().optional(),
    smtpFrom: z.string().optional(),
    smtpPort: z.coerce.number().int().positive().max(65535).default(587),
    smtpSecure: optionalBooleanString,
    passwordResetTokenMinutes: z.coerce.number().int().min(30).max(60).default(45),
    receiptUploadEnabled: optionalBooleanString,
    receiptUploadDir: z.string().trim().min(1).default("uploads/receipts"),
    maxReceiptUploadMb: z.coerce.number().positive().max(50).default(10),
    itemLookupEnabled: optionalBooleanString,
    itemLookupProvider: z.enum(["mock", "amazon", "walmart", "target", "manual"]).default("mock"),
    itemLookupCacheTtlSeconds: z.coerce.number().int().min(60).max(86400).default(3600),
    appBaseUrl: z.url().optional(),
    discordBotToken: z.string().optional(),
    discordClientId: z.string().optional(),
    discordClientSecret: z.string().optional(),
    discordPublicKey: z.string().optional(),
    discordEnabled: optionalBooleanString,
    discordGuildId: z.string().optional()
  })
  .refine((config) => !(config.smtpEnabled && config.smtpPort === 587 && config.smtpSecure), {
    message: "SMTP_SECURE must be false when SMTP_PORT=587. Port 587 uses STARTTLS.",
    path: ["smtpSecure"]
  })
  .refine((config) => !config.discordEnabled || Boolean(config.discordPublicKey), {
    message: "DISCORD_PUBLIC_KEY is required when DISCORD_ENABLED=true.",
    path: ["discordPublicKey"]
  });

export function getAppConfig() {
  return appConfigSchema.parse({
    nodeEnv: process.env.NODE_ENV,
    databaseUrl: process.env.DATABASE_URL,
    nextAuthUrl: process.env.NEXTAUTH_URL,
    tokenDigestSecret: process.env.TOKEN_DIGEST_SECRET,
    authConfigEncryptionKey: process.env.AUTH_CONFIG_ENCRYPTION_KEY,
    smtpEnabled: process.env.SMTP_ENABLED,
    smtpHost: process.env.SMTP_HOST,
    smtpFrom: process.env.SMTP_FROM,
    smtpPort: process.env.SMTP_PORT,
    smtpSecure: process.env.SMTP_SECURE,
    passwordResetTokenMinutes: process.env.PASSWORD_RESET_TOKEN_MINUTES,
    receiptUploadEnabled: process.env.RECEIPT_UPLOAD_ENABLED,
    receiptUploadDir: process.env.RECEIPT_UPLOAD_DIR,
    maxReceiptUploadMb: process.env.MAX_RECEIPT_UPLOAD_MB,
    itemLookupEnabled: process.env.ITEM_LOOKUP_ENABLED,
    itemLookupProvider: process.env.ITEM_LOOKUP_PROVIDER,
    itemLookupCacheTtlSeconds: process.env.ITEM_LOOKUP_CACHE_TTL_SECONDS,
    appBaseUrl: process.env.APP_BASE_URL || process.env.PUBLIC_APP_URL,
    discordBotToken: process.env.DISCORD_BOT_TOKEN,
    discordClientId: process.env.DISCORD_CLIENT_ID,
    discordClientSecret: process.env.DISCORD_CLIENT_SECRET,
    discordPublicKey: process.env.DISCORD_PUBLIC_KEY,
    discordEnabled: process.env.DISCORD_ENABLED,
    discordGuildId: process.env.DISCORD_GUILD_ID
  });
}
