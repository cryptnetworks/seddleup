import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

const migrationsRoot = join(process.cwd(), "prisma", "migrations");
const migrationNames = readdirSync(migrationsRoot)
  .filter((name) => {
    try {
      readFileSync(join(migrationsRoot, name, "migration.sql"));
      return true;
    } catch {
      return false;
    }
  })
  .sort();

function applyMigrations(database: DatabaseSync, names: string[]) {
  for (const name of names) {
    database.exec(readFileSync(join(migrationsRoot, name, "migration.sql"), "utf8"));
  }
}

function withDisposableDatabase(run: (database: DatabaseSync) => void) {
  const directory = mkdtempSync(join(tmpdir(), "seddleup-migration-"));
  const database = new DatabaseSync(join(directory, `${randomUUID()}.db`));
  try {
    database.exec("PRAGMA foreign_keys = ON");
    run(database);
  } finally {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  }
}

function expectHealthyForeignKeys(database: DatabaseSync) {
  expect(database.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
}

describe("settlement migration reconciliation", () => {
  it("applies the combined migration history to a fresh database", () => {
    withDisposableDatabase((database) => {
      applyMigrations(database, migrationNames);
      const columns = database.prepare("PRAGMA table_info(trips)").all() as { name: string }[];
      expect(columns.map((column) => column.name)).toContain("settlementRevision");
      expectHealthyForeignKeys(database);
    });
  });

  it("preserves main trip and expense data when settlement migrations arrive later", () => {
    withDisposableDatabase((database) => {
      const initial = migrationNames.filter((name) => name < "20260715010000_trip_payments");
      const mainOnly = migrationNames.filter(
        (name) =>
          name >= "20260715120000_restrict_participant_financial_deletion" &&
          name < "20260715150000_reconcile_trip_settlement_revision"
      );
      applyMigrations(database, [...initial, ...mainOnly]);
      database.exec(`
        INSERT INTO users (id, username, email, passwordHash, updatedAt)
        VALUES ('main-user', 'main-user', 'main@example.test', 'hash', CURRENT_TIMESTAMP);
        INSERT INTO trips (id, name, destination, updatedAt, ownerId)
        VALUES ('main-trip', 'Main sentinel', 'Preserved', CURRENT_TIMESTAMP, 'main-user');
        INSERT INTO participants (id, name, updatedAt, tripId, userId)
        VALUES ('main-participant', 'Main participant', CURRENT_TIMESTAMP, 'main-trip', 'main-user');
        INSERT INTO expenses (id, title, amount, category, date, updatedAt, payerId, tripId)
        VALUES ('main-expense', 'Main expense', 12.34, 'Food', CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP, 'main-participant', 'main-trip');
      `);

      applyMigrations(database, [
        "20260715010000_trip_payments",
        "20260715150000_reconcile_trip_settlement_revision"
      ]);

      expect(
        database
          .prepare("SELECT name, destination, settlementRevision FROM trips WHERE id = ?")
          .get("main-trip")
      ).toMatchObject({ name: "Main sentinel", destination: "Preserved", settlementRevision: 0 });
      expect(
        database.prepare("SELECT title, amount FROM expenses WHERE id = ?").get("main-expense")
      ).toMatchObject({ title: "Main expense", amount: 12.34 });
      expectHealthyForeignKeys(database);
    });
  });

  it("preserves develop trip and payment data when integrity migrations arrive later", () => {
    withDisposableDatabase((database) => {
      const developBase = migrationNames.filter((name) => name <= "20260715010000_trip_payments");
      applyMigrations(database, developBase);
      database.exec(`
        INSERT INTO users (id, username, email, passwordHash, updatedAt)
        VALUES ('develop-user', 'develop-user', 'develop@example.test', 'hash', CURRENT_TIMESTAMP);
        INSERT INTO trips (id, name, destination, updatedAt, ownerId, settlementRevision)
        VALUES ('develop-trip', 'Develop sentinel', 'Preserved', CURRENT_TIMESTAMP,
                'develop-user', 7);
        INSERT INTO participants (id, name, updatedAt, tripId)
        VALUES ('develop-sender', 'Sender', CURRENT_TIMESTAMP, 'develop-trip');
        INSERT INTO participants (id, name, updatedAt, tripId, userId)
        VALUES ('develop-recipient', 'Recipient', CURRENT_TIMESTAMP,
                'develop-trip', 'develop-user');
        INSERT INTO trip_payments
          (id, amount, date, updatedAt, tripId, senderParticipantId,
           recipientParticipantId, confirmedByUserId)
        VALUES ('develop-payment', 4.56, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
                'develop-trip', 'develop-sender', 'develop-recipient', 'develop-user');
      `);

      applyMigrations(
        database,
        migrationNames.filter(
          (name) => name >= "20260715120000_restrict_participant_financial_deletion"
        )
      );

      expect(
        database
          .prepare("SELECT name, destination, settlementRevision FROM trips WHERE id = ?")
          .get("develop-trip")
      ).toMatchObject({
        name: "Develop sentinel",
        destination: "Preserved",
        settlementRevision: 0
      });
      expect(
        database
          .prepare(
            `SELECT amount, senderParticipantId, recipientParticipantId
             FROM trip_payments WHERE id = ?`
          )
          .get("develop-payment")
      ).toMatchObject({
        amount: 4.56,
        senderParticipantId: "develop-sender",
        recipientParticipantId: "develop-recipient"
      });
      expectHealthyForeignKeys(database);
    });
  });
});
