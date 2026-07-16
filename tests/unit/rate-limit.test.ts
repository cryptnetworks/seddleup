import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AsyncMemoryRateLimitStore,
  checkRateLimit,
  createMemoryRateLimitStore,
  HttpSharedRateLimitStore,
  ResilientRateLimitStore,
  resetRateLimitStoreForTesting
} from "@/lib/rate-limit";

describe("in-memory rate limiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-26T12:00:00Z"));
    resetRateLimitStoreForTesting();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetRateLimitStoreForTesting();
  });

  it("allows requests until the bucket limit is reached", async () => {
    const options = { limit: 2, windowMs: 60_000 };

    await expect(checkRateLimit("login:user@example.com", options)).resolves.toMatchObject({
      allowed: true,
      remaining: 1
    });
    await expect(checkRateLimit("login:user@example.com", options)).resolves.toMatchObject({
      allowed: true,
      remaining: 0
    });
    await expect(checkRateLimit("login:user@example.com", options)).resolves.toMatchObject({
      allowed: false,
      remaining: 0
    });
  });

  it("resets a bucket after the window expires", async () => {
    const options = { limit: 1, windowMs: 60_000 };

    await expect(checkRateLimit("password-reset:user@example.com", options)).resolves.toMatchObject(
      {
        allowed: true
      }
    );
    await expect(checkRateLimit("password-reset:user@example.com", options)).resolves.toMatchObject(
      {
        allowed: false
      }
    );

    vi.advanceTimersByTime(60_000);

    await expect(checkRateLimit("password-reset:user@example.com", options)).resolves.toMatchObject(
      {
        allowed: true,
        remaining: 0
      }
    );
  });

  it("keeps independent buckets by key", async () => {
    const options = { limit: 1, windowMs: 60_000 };

    await expect(checkRateLimit("register:first@example.com", options)).resolves.toMatchObject({
      allowed: true
    });
    await expect(checkRateLimit("register:first@example.com", options)).resolves.toMatchObject({
      allowed: false
    });
    await expect(checkRateLimit("register:second@example.com", options)).resolves.toMatchObject({
      allowed: true
    });
  });

  it("can create isolated memory stores for future store adapters", () => {
    const firstStore = createMemoryRateLimitStore();
    const secondStore = createMemoryRateLimitStore();
    const options = { limit: 1, windowMs: 60_000 };
    const now = Date.now();

    expect(firstStore.check("invite:user-1", options, now).allowed).toBe(true);
    expect(firstStore.check("invite:user-1", options, now).allowed).toBe(false);
    expect(secondStore.check("invite:user-1", options, now).allowed).toBe(true);
  });
});

describe("shared HTTP rate-limit store", () => {
  const options = { limit: 1, windowMs: 60_000 };

  beforeEach(() => {
    process.env.TOKEN_DIGEST_SECRET = "shared-store-digest-secret-for-tests";
  });

  it("sends only digested bucket keys and validates the response", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as {
        buckets: Array<{ key: string; limit: number; windowMs: number }>;
      };
      expect(request.buckets[0]?.key).toMatch(/^[a-f0-9]{64}$/);
      expect(request.buckets[0]?.key).not.toContain("traveler@example.test");
      return new Response(
        JSON.stringify({ results: [{ allowed: true, remaining: 0, resetAt: 1_800_000_000_000 }] }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });
    const store = new HttpSharedRateLimitStore(
      {
        url: "https://rate-limit.example.test/v1/check",
        token: "shared-store-token-for-tests",
        failureMode: "deny",
        timeoutMs: 1000
      },
      fetchMock as typeof fetch
    );

    await expect(
      store.check([{ key: "register:traveler@example.test", options }], new Date())
    ).resolves.toEqual([{ allowed: true, remaining: 0, resetAt: 1_800_000_000_000 }]);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("shares concurrent counters across independent clients", async () => {
    let count = 0;
    const fetchMock = vi.fn(async () => {
      count += 1;
      return new Response(
        JSON.stringify({
          results: [
            { allowed: count <= 1, remaining: Math.max(0, 1 - count), resetAt: 1_800_000_000_000 }
          ]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });
    const config = {
      url: "https://rate-limit.example.test/v1/check",
      token: "shared-store-token-for-tests",
      failureMode: "deny" as const,
      timeoutMs: 1000
    };
    const first = new HttpSharedRateLimitStore(config, fetchMock as typeof fetch);
    const second = new HttpSharedRateLimitStore(config, fetchMock as typeof fetch);

    const results = await Promise.all([
      first.check([{ key: "shared", options }], new Date()),
      second.check([{ key: "shared", options }], new Date())
    ]);
    expect(results.flat().filter((result) => result.allowed)).toHaveLength(1);
  });

  it("fails closed by default and supports explicit local degradation", async () => {
    const unavailable = {
      async check() {
        throw new Error("unavailable");
      }
    };
    const now = new Date("2026-07-15T12:00:00Z");
    const denied = new ResilientRateLimitStore(unavailable, "deny");
    await expect(denied.check([{ key: "shared", options }], now)).resolves.toEqual([
      { allowed: false, remaining: 0, resetAt: now.getTime() + options.windowMs }
    ]);

    const local = new ResilientRateLimitStore(
      unavailable,
      "local",
      new AsyncMemoryRateLimitStore()
    );
    await expect(local.check([{ key: "shared", options }], now)).resolves.toMatchObject([
      { allowed: true }
    ]);
    await expect(local.check([{ key: "shared", options }], now)).resolves.toMatchObject([
      { allowed: false }
    ]);
  });

  it("rejects malformed shared responses", async () => {
    const store = new HttpSharedRateLimitStore(
      {
        url: "https://rate-limit.example.test/v1/check",
        token: "shared-store-token-for-tests",
        failureMode: "deny",
        timeoutMs: 1000
      },
      vi.fn(
        async () => new Response(JSON.stringify({ results: [] }), { status: 200 })
      ) as typeof fetch
    );
    await expect(store.check([{ key: "shared", options }], new Date())).rejects.toThrow(
      "invalid response"
    );
  });
});
