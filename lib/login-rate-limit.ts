import { isIP } from "node:net";
import { digestLookupToken } from "@/lib/token-digest";
import { prisma } from "@/lib/prisma";
import type { RateLimitOptions, RateLimitResult } from "@/lib/rate-limit";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export interface AsyncRateLimitStore {
  check(
    buckets: Array<{ key: string; options: RateLimitOptions }>,
    now: Date
  ): Promise<RateLimitResult[]>;
}

export class PrismaRateLimitStore implements AsyncRateLimitStore {
  async check(buckets: Array<{ key: string; options: RateLimitOptions }>, now: Date) {
    return prisma.$transaction(async (tx) => {
      const results: RateLimitResult[] = [];
      await tx.rateLimitBucket.deleteMany({ where: { resetAt: { lte: now } } });
      for (const { key, options } of buckets) {
        const bucket = await tx.rateLimitBucket.findUnique({ where: { key } });
        if (!bucket || bucket.resetAt <= now) {
          const resetAt = new Date(now.getTime() + options.windowMs);
          await tx.rateLimitBucket.upsert({
            where: { key },
            create: { key, count: 1, resetAt },
            update: { count: 1, resetAt }
          });
          results.push({
            allowed: true,
            remaining: options.limit - 1,
            resetAt: resetAt.getTime()
          });
          continue;
        }

        const updated = await tx.rateLimitBucket.update({
          where: { key },
          data: { count: { increment: 1 } }
        });
        results.push({
          allowed: updated.count <= options.limit,
          remaining: Math.max(0, options.limit - updated.count),
          resetAt: updated.resetAt.getTime()
        });
      }
      return results;
    });
  }
}

export function trustedLoginSource(headers: Headers, trustProxyHeaders = false) {
  if (!trustProxyHeaders) return null;
  const forwarded = headers
    .get("x-forwarded-for")
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .at(-1);
  const candidate = forwarded || headers.get("x-real-ip") || headers.get("cf-connecting-ip");
  return candidate && isIP(candidate) ? candidate : null;
}

export type LoginRateLimitDecision = {
  allowed: boolean;
  reason?: "account_source" | "source" | "account" | "store";
};

export async function checkLoginRateLimit(input: {
  email: string;
  headers: Headers;
  store?: AsyncRateLimitStore;
  now?: Date;
  trustProxyHeaders?: boolean;
}): Promise<LoginRateLimitDecision> {
  const store = input.store ?? new PrismaRateLimitStore();
  const now = input.now ?? new Date();
  const trustProxyHeaders =
    input.trustProxyHeaders ?? process.env.SEDDLEUP_TRUST_PROXY_HEADERS === "true";
  const source = trustedLoginSource(input.headers, trustProxyHeaders);
  const accountKey = digestLookupToken(input.email.trim().toLowerCase());
  const sourceKey = digestLookupToken(source ?? "unattributed-source");
  const buckets: Array<{
    reason: Exclude<LoginRateLimitDecision["reason"], "store" | undefined>;
    key: string;
    options: RateLimitOptions;
  }> = [
    {
      reason: "account_source",
      key: `login:account-source:${accountKey}:${sourceKey}`,
      options: { limit: source ? 8 : 20, windowMs: LOGIN_WINDOW_MS }
    },
    ...(source
      ? [
          {
            reason: "source" as const,
            key: `login:source:${sourceKey}`,
            options: { limit: 60, windowMs: LOGIN_WINDOW_MS }
          }
        ]
      : []),
    {
      reason: "account",
      key: `login:account:${accountKey}`,
      options: { limit: 100, windowMs: LOGIN_WINDOW_MS }
    }
  ];

  try {
    const checks = await store.check(
      buckets.map(({ key, options }) => ({ key, options })),
      now
    );
    const deniedIndex = checks.findIndex((result) => !result.allowed);
    return deniedIndex === -1
      ? { allowed: true }
      : { allowed: false, reason: buckets[deniedIndex]?.reason };
  } catch {
    return { allowed: false, reason: "store" };
  }
}
