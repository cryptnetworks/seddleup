import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

export function createPrismaAdapter() {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";

  if (url.startsWith("file:")) {
    return new PrismaBetterSqlite3({ url, timeout: 10_000 });
  }

  throw new Error("Unsupported DATABASE_URL. Use file: for SQLite.");
}
