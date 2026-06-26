type Bucket = {
  count: number;
  resetAt: number;
};

export type RateLimitOptions = {
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt?: number;
};

export interface RateLimitStore {
  check(key: string, options: RateLimitOptions, now: number): RateLimitResult;
}

export class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, Bucket>();

  check(key: string, options: RateLimitOptions, now: number) {
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      const resetAt = now + options.windowMs;
      this.buckets.set(key, { count: 1, resetAt });
      return { allowed: true, remaining: options.limit - 1, resetAt };
    }

    if (bucket.count >= options.limit) {
      return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
    }

    bucket.count += 1;
    return {
      allowed: true,
      remaining: options.limit - bucket.count,
      resetAt: bucket.resetAt
    };
  }

  clear() {
    this.buckets.clear();
  }
}

const defaultRateLimitStore = new MemoryRateLimitStore();

export function createMemoryRateLimitStore() {
  return new MemoryRateLimitStore();
}

export function resetRateLimitStoreForTesting() {
  defaultRateLimitStore.clear();
}

export function checkRateLimit(key: string, options: RateLimitOptions) {
  return defaultRateLimitStore.check(key, options, Date.now());
}
