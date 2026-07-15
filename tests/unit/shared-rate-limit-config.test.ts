import { describe, expect, it } from "vitest";
import { appConfigSchema } from "@/lib/config";
import { sharedRateLimitConfig } from "@/lib/rate-limit";

const baseConfig = {
  nodeEnv: "production" as const,
  databaseUrl: "file:./test.db",
  nextAuthUrl: "https://app.example.test",
  tokenDigestSecret: "token-digest-secret-for-tests"
};

describe("shared rate-limit configuration", () => {
  it("keeps the shared store disabled by default", () => {
    expect(sharedRateLimitConfig({})).toBeNull();
    expect(appConfigSchema.parse(baseConfig).rateLimitSharedUrl).toBeUndefined();
  });

  it("accepts an authenticated HTTPS endpoint with fail-closed defaults", () => {
    expect(
      sharedRateLimitConfig({
        NODE_ENV: "production",
        RATE_LIMIT_SHARED_URL: "https://rate-limit.example.test/v1/check",
        RATE_LIMIT_SHARED_TOKEN: "shared-store-token-for-tests"
      })
    ).toEqual({
      url: "https://rate-limit.example.test/v1/check",
      token: "shared-store-token-for-tests",
      failureMode: "deny",
      timeoutMs: 1500
    });
  });

  it("rejects insecure production URLs, embedded credentials, and invalid failure modes", () => {
    expect(() =>
      sharedRateLimitConfig({
        NODE_ENV: "production",
        RATE_LIMIT_SHARED_URL: "http://rate-limit.example.test/v1/check",
        RATE_LIMIT_SHARED_TOKEN: "shared-store-token-for-tests"
      })
    ).toThrow("HTTPS");
    expect(() =>
      sharedRateLimitConfig({
        RATE_LIMIT_SHARED_URL: "https://user:pass@rate-limit.example.test/v1/check",
        RATE_LIMIT_SHARED_TOKEN: "shared-store-token-for-tests"
      })
    ).toThrow("embedded credentials");
    expect(() =>
      sharedRateLimitConfig({
        RATE_LIMIT_SHARED_URL: "https://rate-limit.example.test/v1/check",
        RATE_LIMIT_SHARED_TOKEN: "shared-store-token-for-tests",
        RATE_LIMIT_SHARED_FAILURE_MODE: "allow"
      })
    ).toThrow("deny or local");
  });

  it("requires matching app configuration", () => {
    const result = appConfigSchema.safeParse({
      ...baseConfig,
      rateLimitSharedUrl: "https://rate-limit.example.test/v1/check"
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toContain(
        "RATE_LIMIT_SHARED_TOKEN is required when RATE_LIMIT_SHARED_URL is set."
      );
    }
  });
});
