import fs from "node:fs";

const placeholderSecrets = new Set([
  "replace-with-a-long-random-secret",
  "generate-a-long-random-secret-before-running-docker",
  "paste-generated-secret-here"
]);

function stripQuotes(value) {
  if (!value) return value;
  return value.replace(/^["']|["']$/g, "");
}

function loadDotEnv() {
  if (!fs.existsSync(".env")) return;

  const content = fs.readFileSync(".env", "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = stripQuotes(trimmed.slice(separator + 1).trim());
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function fail(message) {
  console.error(
    JSON.stringify({
      level: "error",
      event: "config.invalid",
      time: new Date().toISOString(),
      message
    })
  );
  process.exit(1);
}

function warn(message) {
  console.warn(
    JSON.stringify({
      level: "warn",
      event: "config.warning",
      time: new Date().toISOString(),
      message
    })
  );
}

loadDotEnv();

const nodeEnv = stripQuotes(process.env.NODE_ENV || "development");
const databaseUrl = stripQuotes(process.env.DATABASE_URL || "");
const nextAuthUrl = stripQuotes(process.env.NEXTAUTH_URL || "");
const nextAuthSecret = stripQuotes(process.env.NEXTAUTH_SECRET || "");
const tokenDigestSecret = stripQuotes(process.env.TOKEN_DIGEST_SECRET || "");
const authConfigEncryptionKey = stripQuotes(process.env.AUTH_CONFIG_ENCRYPTION_KEY || "");
const smtpEnabled = stripQuotes(process.env.SMTP_ENABLED || "false") === "true";
const smtpPort = Number(stripQuotes(process.env.SMTP_PORT || "587"));
const smtpSecure = stripQuotes(process.env.SMTP_SECURE || "false") === "true";
const resetMinutes = Number(stripQuotes(process.env.PASSWORD_RESET_TOKEN_MINUTES || "45"));
const discordEnabled = stripQuotes(process.env.DISCORD_ENABLED || "false") === "true";

if (!["development", "test", "production"].includes(nodeEnv)) {
  fail("NODE_ENV must be development, test, or production.");
}

if (!databaseUrl) {
  fail("DATABASE_URL is required.");
}

if (!databaseUrl.startsWith("file:")) {
  fail("DATABASE_URL must start with file:. SQLite is the only supported database engine.");
}

if (!nextAuthUrl) {
  fail("NEXTAUTH_URL is required.");
}

try {
  new URL(nextAuthUrl);
} catch {
  fail("NEXTAUTH_URL must be a valid URL.");
}

if (
  (!nextAuthSecret || placeholderSecrets.has(nextAuthSecret)) &&
  process.env.SEDDLEUP_ALLOW_INSECURE_SECRET !== "1" &&
  process.env.TRIPTALLY_ALLOW_INSECURE_SECRET !== "1"
) {
  fail("NEXTAUTH_SECRET must be set to a real random value.");
}

if (
  (!tokenDigestSecret ||
    placeholderSecrets.has(tokenDigestSecret) ||
    tokenDigestSecret.length < 24) &&
  process.env.SEDDLEUP_ALLOW_INSECURE_SECRET !== "1" &&
  process.env.TRIPTALLY_ALLOW_INSECURE_SECRET !== "1"
) {
  fail("TOKEN_DIGEST_SECRET must be set to a real random value.");
}

if (
  nodeEnv === "production" &&
  (!authConfigEncryptionKey || placeholderSecrets.has(authConfigEncryptionKey))
) {
  fail("AUTH_CONFIG_ENCRYPTION_KEY must be set to a real random value in production.");
}

if (
  nodeEnv === "production" &&
  nextAuthUrl.startsWith("http://") &&
  !nextAuthUrl.includes("localhost")
) {
  warn("NEXTAUTH_URL is HTTP in production. Use HTTPS behind a trusted proxy.");
}

if (!Number.isFinite(resetMinutes) || resetMinutes < 30 || resetMinutes > 60) {
  fail("PASSWORD_RESET_TOKEN_MINUTES must be between 30 and 60.");
}

if (smtpEnabled) {
  if (!process.env.SMTP_HOST) fail("SMTP_HOST is required when SMTP_ENABLED=true.");
  if (!process.env.SMTP_FROM) fail("SMTP_FROM is required when SMTP_ENABLED=true.");
  if (!Number.isFinite(smtpPort) || smtpPort <= 0 || smtpPort > 65535) {
    fail("SMTP_PORT must be a valid TCP port.");
  }
  if (smtpPort === 587 && smtpSecure) {
    fail("SMTP_SECURE must be false when SMTP_PORT=587. Port 587 uses STARTTLS.");
  }
  if (smtpPort === 465 && !smtpSecure) {
    warn("SMTP_PORT=465 usually requires SMTP_SECURE=true.");
  }
}

if (discordEnabled && !stripQuotes(process.env.DISCORD_PUBLIC_KEY || "")) {
  fail("DISCORD_PUBLIC_KEY is required when DISCORD_ENABLED=true.");
}

console.info(
  JSON.stringify({
    level: "info",
    event: "config.valid",
    time: new Date().toISOString(),
    nodeEnv,
    smtpEnabled,
    discordEnabled
  })
);
