import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { appConfigSchema } from "@/lib/config";
import { createPrismaAdapter } from "@/lib/prisma-adapter";

const validConfig = {
  nodeEnv: "test",
  databaseUrl: "file:./test.db",
  nextAuthUrl: "http://localhost:3000",
  tokenDigestSecret: "test-token-digest-secret-123",
  authConfigEncryptionKey: "test-auth-config-key-123456"
};

describe("database configuration", () => {
  it("accepts SQLite file DATABASE_URL values", () => {
    const parsed = appConfigSchema.parse(validConfig);

    expect(parsed.databaseUrl).toBe("file:./test.db");
  });

  it("rejects Postgres DATABASE_URL values in app config", () => {
    const result = appConfigSchema.safeParse({
      ...validConfig,
      databaseUrl: "postgresql://user:pass@localhost:5432/seddleup"
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      "DATABASE_URL must use file:. SQLite is the only supported database engine."
    );
  });

  it("rejects Postgres DATABASE_URL values before creating a Prisma adapter", () => {
    const previousDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/seddleup";

    try {
      expect(() => createPrismaAdapter()).toThrow(
        "Unsupported DATABASE_URL. Use file: for SQLite."
      );
    } finally {
      if (previousDatabaseUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = previousDatabaseUrl;
      }
    }
  });

  it("fails config validation clearly for Postgres DATABASE_URL values", () => {
    const result = spawnSync(process.execPath, ["scripts/validate-config.mjs"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: "test",
        DATABASE_URL: "postgres://user:pass@localhost:5432/seddleup",
        NEXTAUTH_URL: "http://localhost:3000",
        NEXTAUTH_SECRET: "test-nextauth-secret-123456",
        TOKEN_DIGEST_SECRET: "test-token-digest-secret-123",
        AUTH_CONFIG_ENCRYPTION_KEY: "test-auth-config-key-123456",
        SEDDLEUP_ALLOW_INSECURE_SECRET: "1"
      },
      encoding: "utf8"
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "DATABASE_URL must start with file:. SQLite is the only supported database engine."
    );
  });
});
