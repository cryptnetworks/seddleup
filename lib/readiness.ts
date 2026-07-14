import { readdir } from "node:fs/promises";
import path from "node:path";

import { getAppConfig } from "@/lib/config";
import { prisma } from "@/lib/prisma";

export type ReadinessCheckStatus = "ready" | "unavailable" | "not_checked";
export type ReadinessCheck = "configuration" | "database" | "migrations";

export type ReadinessResult = {
  status: "ready" | "not_ready";
  checks: Record<ReadinessCheck, ReadinessCheckStatus>;
  failedCheck?: ReadinessCheck;
};

type MigrationRecord = {
  migration_name: string;
  finished_at: Date | string | null;
  rolled_back_at: Date | string | null;
};

type ReadinessDependencies = {
  validateConfig: () => void | Promise<void>;
  pingDatabase: () => Promise<void>;
  listExpectedMigrations: () => Promise<string[]>;
  listMigrationRecords: () => Promise<MigrationRecord[]>;
};

const defaultDependencies: ReadinessDependencies = {
  validateConfig: () => {
    getAppConfig();
  },
  pingDatabase: async () => {
    await prisma.$queryRaw`SELECT 1`;
  },
  listExpectedMigrations: async () => {
    const migrationsDirectory = path.join(process.cwd(), "prisma", "migrations");
    const entries = await readdir(migrationsDirectory, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  },
  listMigrationRecords: () =>
    prisma.$queryRaw<MigrationRecord[]>`
      SELECT migration_name, finished_at, rolled_back_at
      FROM "_prisma_migrations"
    `
};

function notReady(failedCheck: ReadinessCheck, checks: ReadinessResult["checks"]): ReadinessResult {
  return {
    status: "not_ready",
    checks: {
      ...checks,
      [failedCheck]: "unavailable"
    },
    failedCheck
  };
}

function migrationsAreReady(expected: string[], records: MigrationRecord[]) {
  if (expected.length === 0) {
    return false;
  }

  const applied = new Set(
    records
      .filter((record) => record.finished_at !== null && record.rolled_back_at === null)
      .map((record) => record.migration_name)
  );
  const hasFailedMigration = records.some(
    (record) => record.finished_at === null && record.rolled_back_at === null
  );

  return !hasFailedMigration && expected.every((migration) => applied.has(migration));
}

export async function checkReadiness(
  overrides: Partial<ReadinessDependencies> = {}
): Promise<ReadinessResult> {
  const dependencies = { ...defaultDependencies, ...overrides };
  const checks: ReadinessResult["checks"] = {
    configuration: "not_checked",
    database: "not_checked",
    migrations: "not_checked"
  };

  try {
    await dependencies.validateConfig();
    checks.configuration = "ready";
  } catch {
    return notReady("configuration", checks);
  }

  try {
    await dependencies.pingDatabase();
    checks.database = "ready";
  } catch {
    return notReady("database", checks);
  }

  try {
    const [expected, records] = await Promise.all([
      dependencies.listExpectedMigrations(),
      dependencies.listMigrationRecords()
    ]);

    if (!migrationsAreReady(expected, records)) {
      return notReady("migrations", checks);
    }
    checks.migrations = "ready";
  } catch {
    return notReady("migrations", checks);
  }

  return { status: "ready", checks };
}
