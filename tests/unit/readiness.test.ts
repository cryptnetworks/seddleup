import { describe, expect, it, vi } from "vitest";

import { checkReadiness } from "@/lib/readiness";

const migration = "20260526120000_init";

function readyDependencies() {
  return {
    validateConfig: vi.fn(),
    pingDatabase: vi.fn().mockResolvedValue(undefined),
    listExpectedMigrations: vi.fn().mockResolvedValue([migration]),
    listMigrationRecords: vi.fn().mockResolvedValue([
      {
        migration_name: migration,
        finished_at: new Date(),
        rolled_back_at: null
      }
    ])
  };
}

describe("readiness diagnostics", () => {
  it("reports ready only after config, database, and migrations pass", async () => {
    await expect(checkReadiness(readyDependencies())).resolves.toEqual({
      status: "ready",
      checks: {
        configuration: "ready",
        database: "ready",
        migrations: "ready"
      }
    });
  });

  it("stops after invalid configuration without exposing error details", async () => {
    const dependencies = readyDependencies();
    const sensitiveValue = "file:/private/operator/database.db";
    dependencies.validateConfig.mockImplementation(() => {
      throw new Error(sensitiveValue);
    });

    const result = await checkReadiness(dependencies);

    expect(result).toEqual({
      status: "not_ready",
      failedCheck: "configuration",
      checks: {
        configuration: "unavailable",
        database: "not_checked",
        migrations: "not_checked"
      }
    });
    expect(JSON.stringify(result)).not.toContain(sensitiveValue);
    expect(dependencies.pingDatabase).not.toHaveBeenCalled();
  });

  it("distinguishes database connectivity failures from configuration failures", async () => {
    const dependencies = readyDependencies();
    dependencies.pingDatabase.mockRejectedValue(new Error("database path must stay private"));

    await expect(checkReadiness(dependencies)).resolves.toEqual({
      status: "not_ready",
      failedCheck: "database",
      checks: {
        configuration: "ready",
        database: "unavailable",
        migrations: "not_checked"
      }
    });
    expect(dependencies.listExpectedMigrations).not.toHaveBeenCalled();
  });

  it("reports missing bundled migrations as not ready", async () => {
    const dependencies = readyDependencies();
    dependencies.listExpectedMigrations.mockResolvedValue([migration, "20260527120000_next"]);

    const result = await checkReadiness(dependencies);

    expect(result.status).toBe("not_ready");
    expect(result.failedCheck).toBe("migrations");
    expect(result.checks.migrations).toBe("unavailable");
  });

  it("reports an unfinished Prisma migration as not ready", async () => {
    const dependencies = readyDependencies();
    dependencies.listMigrationRecords.mockResolvedValue([
      {
        migration_name: migration,
        finished_at: null,
        rolled_back_at: null
      }
    ]);

    const result = await checkReadiness(dependencies);

    expect(result.status).toBe("not_ready");
    expect(result.failedCheck).toBe("migrations");
  });

  it("requires the bundled migration manifest to be available", async () => {
    const dependencies = readyDependencies();
    dependencies.listExpectedMigrations.mockResolvedValue([]);

    const result = await checkReadiness(dependencies);

    expect(result.status).toBe("not_ready");
    expect(result.failedCheck).toBe("migrations");
  });
});
