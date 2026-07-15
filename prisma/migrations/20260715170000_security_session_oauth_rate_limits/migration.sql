ALTER TABLE "users" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "oauth_state_credentials" ADD COLUMN "purpose" TEXT NOT NULL DEFAULT 'login';
ALTER TABLE "oauth_state_credentials" ADD COLUMN "userId" TEXT;
CREATE INDEX "oauth_state_credentials_userId_purpose_idx"
  ON "oauth_state_credentials"("userId", "purpose");

CREATE TABLE "rate_limit_buckets" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "count" INTEGER NOT NULL,
  "resetAt" DATETIME NOT NULL,
  "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "rate_limit_buckets_resetAt_idx" ON "rate_limit_buckets"("resetAt");
