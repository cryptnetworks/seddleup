import { DatabaseSync } from "node:sqlite";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

function sqlitePathFromDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL || "file:./playwright.db";
  if (!databaseUrl.startsWith("file:")) {
    throw new Error("Playwright database reset expects a SQLite DATABASE_URL.");
  }

  const rawPath = databaseUrl.slice("file:".length);
  return path.isAbsolute(rawPath) ? rawPath : path.resolve(rawPath);
}

const dbPath = sqlitePathFromDatabaseUrl();
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
fs.rmSync(dbPath, { force: true });

const db = new DatabaseSync(dbPath);
db.exec("PRAGMA foreign_keys = OFF;");
db.exec(`
  CREATE TABLE "_prisma_migrations" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "checksum" TEXT NOT NULL,
    "finished_at" DATETIME,
    "migration_name" TEXT NOT NULL,
    "logs" TEXT,
    "rolled_back_at" DATETIME,
    "started_at" DATETIME NOT NULL DEFAULT current_timestamp,
    "applied_steps_count" INTEGER UNSIGNED NOT NULL DEFAULT 0
  )
`);

const recordMigration = db.prepare(`
  INSERT INTO "_prisma_migrations" (
    id,
    checksum,
    finished_at,
    migration_name,
    started_at,
    applied_steps_count
  ) VALUES (?, ?, ?, ?, ?, 1)
`);

const migrationsDir = path.resolve("prisma/migrations");
for (const entry of fs.readdirSync(migrationsDir).sort()) {
  const migrationPath = path.join(migrationsDir, entry, "migration.sql");
  if (!fs.existsSync(migrationPath)) continue;
  const migrationSql = fs.readFileSync(migrationPath, "utf8");
  const appliedAt = new Date().toISOString();

  db.exec("BEGIN");
  try {
    db.exec(migrationSql);
    recordMigration.run(
      randomUUID(),
      createHash("sha256").update(migrationSql).digest("hex"),
      appliedAt,
      entry,
      appliedAt
    );
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

db.exec("PRAGMA foreign_keys = ON;");
db.close();
