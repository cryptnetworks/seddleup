-- Persist only keyed digests so OAuth state can be consumed atomically.
CREATE TABLE "oauth_state_credentials" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stateHash" TEXT NOT NULL,
    "verifierHash" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "oauth_state_credentials_stateHash_key" ON "oauth_state_credentials"("stateHash");
CREATE INDEX "oauth_state_credentials_providerId_expiresAt_idx" ON "oauth_state_credentials"("providerId", "expiresAt");
CREATE INDEX "oauth_state_credentials_usedAt_idx" ON "oauth_state_credentials"("usedAt");
