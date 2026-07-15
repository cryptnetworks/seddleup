import { beforeEach, describe, expect, it } from "vitest";
import { checkLoginRateLimit, trustedLoginSource } from "@/lib/login-rate-limit";
import type { AsyncRateLimitStore, RateLimitOptions, RateLimitResult } from "@/lib/rate-limit";

type Bucket = { count: number; resetAt: number };

class SharedMemoryStore implements AsyncRateLimitStore {
  constructor(private readonly buckets: Map<string, Bucket>) {}

  async check(
    checks: Array<{ key: string; options: RateLimitOptions }>,
    now: Date
  ): Promise<RateLimitResult[]> {
    return checks.map(({ key, options }) => {
      const existing = this.buckets.get(key);
      if (!existing || existing.resetAt <= now.getTime()) {
        const resetAt = now.getTime() + options.windowMs;
        this.buckets.set(key, { count: 1, resetAt });
        return { allowed: true, remaining: options.limit - 1, resetAt };
      }
      existing.count += 1;
      return {
        allowed: existing.count <= options.limit,
        remaining: Math.max(0, options.limit - existing.count),
        resetAt: existing.resetAt
      };
    });
  }
}

function proxyHeaders(source: string) {
  return new Headers({ "x-forwarded-for": `198.51.100.2, ${source}` });
}

describe("multidimensional login rate limiting", () => {
  beforeEach(() => {
    process.env.TOKEN_DIGEST_SECRET = "login-rate-limit-test-secret-long-enough";
  });

  it("limits one account/source pair without locking out another source", async () => {
    const store = new SharedMemoryStore(new Map());
    const input = {
      email: "traveler@example.test",
      store,
      trustProxyHeaders: true
    };

    for (let attempt = 0; attempt < 8; attempt += 1) {
      await expect(
        checkLoginRateLimit({ ...input, headers: proxyHeaders("203.0.113.10") })
      ).resolves.toEqual({ allowed: true });
    }
    await expect(
      checkLoginRateLimit({ ...input, headers: proxyHeaders("203.0.113.10") })
    ).resolves.toMatchObject({ allowed: false, reason: "account_source" });
    await expect(
      checkLoginRateLimit({ ...input, headers: proxyHeaders("203.0.113.11") })
    ).resolves.toEqual({ allowed: true });
  });

  it("shares counters across store instances and resets expired buckets", async () => {
    const buckets = new Map<string, Bucket>();
    const firstStore = new SharedMemoryStore(buckets);
    const secondStore = new SharedMemoryStore(buckets);
    const start = new Date("2026-07-15T12:00:00Z");
    const input = {
      email: "shared@example.test",
      headers: proxyHeaders("203.0.113.20"),
      trustProxyHeaders: true,
      now: start
    };

    for (let attempt = 0; attempt < 8; attempt += 1) {
      await checkLoginRateLimit({ ...input, store: firstStore });
    }
    await expect(checkLoginRateLimit({ ...input, store: secondStore })).resolves.toMatchObject({
      allowed: false
    });
    await expect(
      checkLoginRateLimit({
        ...input,
        store: secondStore,
        now: new Date(start.getTime() + 15 * 60 * 1000 + 1)
      })
    ).resolves.toEqual({ allowed: true });
  });

  it("fails closed when the shared store is unavailable", async () => {
    const store: AsyncRateLimitStore = {
      async check() {
        throw new Error("store unavailable");
      }
    };

    await expect(
      checkLoginRateLimit({
        email: "failure@example.test",
        headers: proxyHeaders("203.0.113.30"),
        store,
        trustProxyHeaders: true
      })
    ).resolves.toEqual({ allowed: false, reason: "store" });
  });

  it("uses forwarding headers only when a trusted proxy is configured", () => {
    const headers = proxyHeaders("203.0.113.40");
    expect(trustedLoginSource(headers, false)).toBeNull();
    expect(trustedLoginSource(headers, true)).toBe("203.0.113.40");
  });

  it("does not create a global lockout when no trusted source is available", async () => {
    const store = new SharedMemoryStore(new Map());

    for (let account = 0; account < 61; account += 1) {
      await expect(
        checkLoginRateLimit({
          email: `traveler-${account}@example.test`,
          headers: proxyHeaders("203.0.113.50"),
          store,
          trustProxyHeaders: false
        })
      ).resolves.toEqual({ allowed: true });
    }
  });
});
