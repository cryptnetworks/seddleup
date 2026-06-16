import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";

export function createPrismaAdapter() {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";

  if (url.startsWith("file:")) {
    return new PrismaBetterSqlite3({ url, timeout: 10_000 });
  }

  if (url.startsWith("postgresql:") || url.startsWith("postgres:")) {
    return new PrismaPg({ connectionString: url });
  }

  throw new Error(
    "Unsupported DATABASE_URL. Use file: for SQLite or postgres/postgresql for PostgreSQL."
  );
}
