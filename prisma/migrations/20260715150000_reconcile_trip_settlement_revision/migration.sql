-- Reconcile the divergent trip-payment and owner-restriction migration order.
-- The revision is an internal concurrency token, so resetting it during a
-- stopped deployment does not alter financial history or user-visible data.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_trips" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "destination" TEXT,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "ownerId" TEXT NOT NULL,
    "settlementRevision" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "trips_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_trips" ("createdAt", "destination", "endDate", "id", "name", "ownerId", "settlementRevision", "startDate", "updatedAt")
SELECT "createdAt", "destination", "endDate", "id", "name", "ownerId", 0, "startDate", "updatedAt" FROM "trips";
DROP TABLE "trips";
ALTER TABLE "new_trips" RENAME TO "trips";
CREATE INDEX "trips_ownerId_idx" ON "trips"("ownerId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
