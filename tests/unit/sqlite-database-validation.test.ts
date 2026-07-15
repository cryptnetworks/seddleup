import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";

const temporaryDirectories: string[] = [];

function temporaryDatabasePath() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "seddleup-sqlite-validation-"));
  temporaryDirectories.push(directory);
  return path.join(directory, "database.db");
}

function validate(databasePath: string) {
  return execFileSync(process.execPath, ["scripts/validate-sqlite-database.mjs", databasePath], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("SQLite startup validation", () => {
  it("accepts a valid SQLite database", () => {
    const databasePath = temporaryDatabasePath();
    const database = new DatabaseSync(databasePath);
    database.exec("CREATE TABLE probe (id TEXT PRIMARY KEY)");
    database.close();

    expect(validate(databasePath)).toContain('"event":"startup.sqlite_valid"');
  });

  it("rejects invalid bytes without echoing database contents", () => {
    const databasePath = temporaryDatabasePath();
    const fixture = "invalid-sensitive-fixture-content";
    fs.writeFileSync(databasePath, fixture);

    expect(() => validate(databasePath)).toThrowError(
      expect.objectContaining({
        stderr: expect.not.stringContaining(fixture),
        status: 1
      })
    );
  });
});
