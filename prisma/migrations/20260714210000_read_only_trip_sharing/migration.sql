CREATE TABLE "trip_share_links" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "participantNameMode" TEXT NOT NULL DEFAULT 'anonymized',
    "expiresAt" DATETIME,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "tripId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    CONSTRAINT "trip_share_links_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "trip_share_links_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "trip_share_links_tokenHash_key" ON "trip_share_links"("tokenHash");
CREATE UNIQUE INDEX "trip_share_links_tripId_key" ON "trip_share_links"("tripId");
CREATE INDEX "trip_share_links_expiresAt_idx" ON "trip_share_links"("expiresAt");
CREATE INDEX "trip_share_links_revokedAt_idx" ON "trip_share_links"("revokedAt");
CREATE INDEX "trip_share_links_createdByUserId_idx" ON "trip_share_links"("createdByUserId");
