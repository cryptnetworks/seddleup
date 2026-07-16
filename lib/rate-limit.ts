import { digestLookupToken } from "@/lib/token-digest";

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

export type RateLimitCheck = { key: string; options: RateLimitOptions };

export interface AsyncRateLimitStore {
  check(buckets: RateLimitCheck[], now: Date): Promise<RateLimitResult[]>;
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

export class AsyncMemoryRateLimitStore implements AsyncRateLimitStore {
  constructor(private readonly store = new MemoryRateLimitStore()) {}

  async check(buckets: RateLimitCheck[], now: Date) {
    return buckets.map(({ key, options }) => this.store.check(key, options, now.getTime()));
  }
}

export type SharedRateLimitFailureMode = "deny" | "local";

type SharedRateLimitConfig = {
  url: string;
  token: string;
  failureMode: SharedRateLimitFailureMode;
  timeoutMs: number;
};

type FetchLike = typeof fetch;

function validResult(value: unknown): value is RateLimitResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  return (
    typeof result.allowed === "boolean" &&
    typeof result.remaining === "number" &&
    Number.isInteger(result.remaining) &&
    result.remaining >= 0 &&
    typeof result.resetAt === "number" &&
    Number.isFinite(result.resetAt)
  );
}

export class HttpSharedRateLimitStore implements AsyncRateLimitStore {
  constructor(
    private readonly config: SharedRateLimitConfig,
    private readonly fetchImplementation: FetchLike = fetch
  ) {}

  async check(buckets: RateLimitCheck[], now: Date) {
    void now;
    if (buckets.length === 0) return [];

    const response = await this.fetchImplementation(this.config.url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.config.token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        version: 1,
        buckets: buckets.map(({ key, options }) => ({
          key: digestLookupToken(`rate-limit:${key}`),
          limit: options.limit,
          windowMs: options.windowMs
        }))
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(this.config.timeoutMs)
    });

    if (!response.ok) throw new Error("Shared rate-limit store rejected the request.");
    const body = (await response.json()) as { results?: unknown };
    if (
      !Array.isArray(body.results) ||
      body.results.length !== buckets.length ||
      !body.results.every(validResult)
    ) {
      throw new Error("Shared rate-limit store returned an invalid response.");
    }
    return body.results;
  }
}

export class ResilientRateLimitStore implements AsyncRateLimitStore {
  constructor(
    private readonly sharedStore: AsyncRateLimitStore,
    private readonly failureMode: SharedRateLimitFailureMode,
    private readonly localStore: AsyncRateLimitStore = new AsyncMemoryRateLimitStore()
  ) {}

  async check(buckets: RateLimitCheck[], now: Date) {
    try {
      return await this.sharedStore.check(buckets, now);
    } catch {
      if (this.failureMode === "local") return this.localStore.check(buckets, now);
      return buckets.map(({ options }) => ({
        allowed: false,
        remaining: 0,
        resetAt: now.getTime() + options.windowMs
      }));
    }
  }
}

export function sharedRateLimitConfig(
  env: Readonly<Record<string, string | undefined>> = process.env
): SharedRateLimitConfig | null {
  const rawUrl = env.RATE_LIMIT_SHARED_URL?.trim();
  if (!rawUrl) return null;
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" && env.NODE_ENV === "production") {
    throw new Error("RATE_LIMIT_SHARED_URL must use HTTPS in production.");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("RATE_LIMIT_SHARED_URL must be an HTTP(S) URL without embedded credentials.");
  }
  const token = env.RATE_LIMIT_SHARED_TOKEN?.trim() ?? "";
  if (token.length < 24) {
    throw new Error("RATE_LIMIT_SHARED_TOKEN must contain at least 24 characters.");
  }
  const failureMode = env.RATE_LIMIT_SHARED_FAILURE_MODE ?? "deny";
  if (failureMode !== "deny" && failureMode !== "local") {
    throw new Error("RATE_LIMIT_SHARED_FAILURE_MODE must be deny or local.");
  }
  const timeoutMs = Number(env.RATE_LIMIT_SHARED_TIMEOUT_MS ?? "1500");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 10_000) {
    throw new Error("RATE_LIMIT_SHARED_TIMEOUT_MS must be an integer from 100 to 10000.");
  }
  return { url: url.toString(), token, failureMode, timeoutMs };
}

let configuredStore: AsyncRateLimitStore | null | undefined;

export function configuredSharedRateLimitStore() {
  if (configuredStore !== undefined) return configuredStore;
  const config = sharedRateLimitConfig();
  configuredStore = config
    ? new ResilientRateLimitStore(new HttpSharedRateLimitStore(config), config.failureMode)
    : null;
  return configuredStore;
}

export function createMemoryRateLimitStore() {
  return new MemoryRateLimitStore();
}

export function resetRateLimitStoreForTesting() {
  defaultRateLimitStore.clear();
  configuredStore = undefined;
}

export async function checkRateLimit(key: string, options: RateLimitOptions) {
  const now = new Date();
  const sharedStore = configuredSharedRateLimitStore();
  if (sharedStore) return (await sharedStore.check([{ key, options }], now))[0]!;
  return defaultRateLimitStore.check(key, options, now.getTime());
}
