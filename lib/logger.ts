type LogLevel = "info" | "warn" | "error";

type LogFields = Record<string, unknown>;

const REDACTED = "[REDACTED]";
const sensitiveKeyPattern =
  /(password|passphrase|token|secret|credential|authorization|cookie|mfa|totp|recovery|smtp|discord|databaseurl|storedpath|receiptpath|filepath|rawrequestbody|reseturl|verifyurl|verificationurl|inviteurl|shareurl|oauthstate|authorizationcode|clientsecret)/i;
const sensitiveQueryKeyPattern =
  /^(access_token|authorization|code|cookie|credential|id_token|invite|mfa|password|recovery|refresh_token|reset|secret|state|token|verification)$/i;
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const connectionStringPattern =
  /\b(?:file|mongodb(?:\+srv)?|mysql|postgres(?:ql)?|redis):\/\/[^\s"']+|\bfile:[^\s"']+/gi;
const bearerPattern = /\bBearer\s+[^\s,"']+/gi;

function normalizeKey(key: string) {
  return key.replaceAll(/[^a-z0-9]/gi, "").toLowerCase();
}

function isSensitiveKey(key: string) {
  const normalized = normalizeKey(key);
  return normalized === "code" || normalized === "email" || sensitiveKeyPattern.test(normalized);
}

function redactUrl(value: string) {
  if (!value.includes("?") || (!value.startsWith("/") && !value.includes("://"))) return value;
  try {
    const relative = value.startsWith("/");
    const url = new URL(value, relative ? "https://redaction.invalid" : undefined);
    for (const key of url.searchParams.keys()) {
      if (sensitiveQueryKeyPattern.test(key)) url.searchParams.set(key, REDACTED);
    }
    return relative ? `${url.pathname}${url.search}${url.hash}` : url.toString();
  } catch {
    return value;
  }
}

function redactString(value: string) {
  return redactUrl(value)
    .replaceAll(connectionStringPattern, REDACTED)
    .replaceAll(bearerPattern, `Bearer ${REDACTED}`)
    .replaceAll(emailPattern, REDACTED);
}

function redactValue(value: unknown, key: string, seen: WeakSet<object>): unknown {
  if (isSensitiveKey(key)) return REDACTED;
  if (typeof value === "string") return redactString(value);
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;
  if (value === undefined) return undefined;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return { name: value.name, message: redactString(value.message) };
  }
  if (Array.isArray(value)) return value.map((item) => redactValue(item, key, seen));
  if (typeof value === "object") {
    if (seen.has(value)) return REDACTED;
    seen.add(value);
    return Object.fromEntries(
      Object.entries(value).map(([nestedKey, nestedValue]) => [
        nestedKey,
        redactValue(nestedValue, nestedKey, seen)
      ])
    );
  }
  return redactString(String(value));
}

export function redactLogFields(fields: LogFields = {}) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, redactValue(value, key, new WeakSet())])
  );
}

export function serializeLogEntry(
  level: LogLevel,
  event: string,
  fields: LogFields = {},
  time = new Date()
) {
  return JSON.stringify({
    ...redactLogFields(fields),
    level,
    event,
    time: time.toISOString()
  });
}

function write(level: LogLevel, event: string, fields: LogFields = {}) {
  const line = serializeLogEntry(level, event, fields);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.info(line);
  }
}

export const logger = {
  info: (event: string, fields?: LogFields) => write("info", event, fields),
  warn: (event: string, fields?: LogFields) => write("warn", event, fields),
  error: (event: string, fields?: LogFields) => write("error", event, fields)
};
