import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";

function fail(message) {
  console.error(
    JSON.stringify({
      level: "error",
      event: "startup.sqlite_validation_failed",
      message
    })
  );
  process.exit(1);
}

const databasePath = process.argv[2];

if (!databasePath) {
  fail("SQLite database path is required.");
}

let stats;
try {
  stats = fs.statSync(databasePath);
} catch {
  fail("SQLite database file cannot be inspected.");
}

if (!stats.isFile()) {
  fail("SQLite database path is not a regular file.");
}

let database;
try {
  database = new DatabaseSync(databasePath, { readOnly: true });
  const results = database.prepare("PRAGMA quick_check").all();
  const valid =
    results.length > 0 &&
    results.every((row) => Object.values(row).every((value) => value === "ok"));

  if (!valid) {
    fail("SQLite quick_check did not return ok.");
  }
} catch {
  fail("SQLite database cannot be opened or is invalid.");
} finally {
  database?.close();
}

console.info(
  JSON.stringify({
    level: "info",
    event: "startup.sqlite_valid",
    message: "SQLite database validation succeeded."
  })
);
