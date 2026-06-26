import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkRateLimit,
  createMemoryRateLimitStore,
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

  it("allows requests until the bucket limit is reached", () => {
    const options = { limit: 2, windowMs: 60_000 };

    expect(checkRateLimit("login:user@example.com", options)).toMatchObject({
      allowed: true,
      remaining: 1
    });
    expect(checkRateLimit("login:user@example.com", options)).toMatchObject({
      allowed: true,
      remaining: 0
    });
    expect(checkRateLimit("login:user@example.com", options)).toMatchObject({
      allowed: false,
      remaining: 0
    });
  });

  it("resets a bucket after the window expires", () => {
    const options = { limit: 1, windowMs: 60_000 };

    expect(checkRateLimit("password-reset:user@example.com", options).allowed).toBe(true);
    expect(checkRateLimit("password-reset:user@example.com", options).allowed).toBe(false);

    vi.advanceTimersByTime(60_000);

    expect(checkRateLimit("password-reset:user@example.com", options)).toMatchObject({
      allowed: true,
      remaining: 0
    });
  });

  it("keeps independent buckets by key", () => {
    const options = { limit: 1, windowMs: 60_000 };

    expect(checkRateLimit("register:first@example.com", options).allowed).toBe(true);
    expect(checkRateLimit("register:first@example.com", options).allowed).toBe(false);
    expect(checkRateLimit("register:second@example.com", options).allowed).toBe(true);
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
