ALTER TABLE "trips" ADD COLUMN "settlementRevision" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "trip_payments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "amount" DECIMAL NOT NULL CHECK ("amount" > 0 AND "amount" <= 1000000),
    "date" DATETIME NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "tripId" TEXT NOT NULL,
    "senderParticipantId" TEXT NOT NULL,
    "recipientParticipantId" TEXT NOT NULL,
    "confirmedByUserId" TEXT,
    "confirmedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK ("senderParticipantId" <> "recipientParticipantId"),
    CONSTRAINT "trip_payments_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "trip_payments_senderParticipantId_fkey" FOREIGN KEY ("senderParticipantId") REFERENCES "participants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "trip_payments_recipientParticipantId_fkey" FOREIGN KEY ("recipientParticipantId") REFERENCES "participants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "trip_payments_confirmedByUserId_fkey" FOREIGN KEY ("confirmedByUserId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TRIGGER "trip_payments_participants_same_trip_insert"
BEFORE INSERT ON "trip_payments"
FOR EACH ROW
WHEN NOT EXISTS (
    SELECT 1
    FROM "participants" AS sender
    JOIN "participants" AS recipient ON recipient."id" = NEW."recipientParticipantId"
    WHERE sender."id" = NEW."senderParticipantId"
      AND sender."tripId" = NEW."tripId"
      AND recipient."tripId" = NEW."tripId"
)
BEGIN
    SELECT RAISE(ABORT, 'trip payment participants must belong to trip');
END;

CREATE TRIGGER "trip_payments_confirmer_is_recipient_insert"
BEFORE INSERT ON "trip_payments"
FOR EACH ROW
WHEN NEW."confirmedByUserId" IS NULL OR NOT EXISTS (
    SELECT 1
    FROM "participants" AS recipient
    WHERE recipient."id" = NEW."recipientParticipantId"
      AND recipient."tripId" = NEW."tripId"
      AND recipient."userId" = NEW."confirmedByUserId"
)
BEGIN
    SELECT RAISE(ABORT, 'trip payment confirmer must be the linked recipient');
END;

CREATE TRIGGER "trip_payments_immutable_confirmation"
BEFORE UPDATE OF "tripId", "senderParticipantId", "recipientParticipantId", "amount", "confirmedAt", "confirmedByUserId" ON "trip_payments"
FOR EACH ROW
WHEN NEW."tripId" <> OLD."tripId"
  OR NEW."senderParticipantId" <> OLD."senderParticipantId"
  OR NEW."recipientParticipantId" <> OLD."recipientParticipantId"
  OR NEW."amount" <> OLD."amount"
  OR NEW."confirmedAt" <> OLD."confirmedAt"
  OR (NEW."confirmedByUserId" IS NOT OLD."confirmedByUserId" AND NEW."confirmedByUserId" IS NOT NULL)
BEGIN
    SELECT RAISE(ABORT, 'trip payment confirmation fields are immutable');
END;

CREATE TRIGGER "trip_payments_participants_same_trip_update"
BEFORE UPDATE OF "tripId", "senderParticipantId", "recipientParticipantId" ON "trip_payments"
FOR EACH ROW
WHEN NOT EXISTS (
    SELECT 1
    FROM "participants" AS sender
    JOIN "participants" AS recipient ON recipient."id" = NEW."recipientParticipantId"
    WHERE sender."id" = NEW."senderParticipantId"
      AND sender."tripId" = NEW."tripId"
      AND recipient."tripId" = NEW."tripId"
)
BEGIN
    SELECT RAISE(ABORT, 'trip payment participants must belong to trip');
END;

CREATE INDEX "trip_payments_tripId_date_idx" ON "trip_payments"("tripId", "date");
CREATE INDEX "trip_payments_senderParticipantId_idx" ON "trip_payments"("senderParticipantId");
CREATE INDEX "trip_payments_recipientParticipantId_idx" ON "trip_payments"("recipientParticipantId");
CREATE INDEX "trip_payments_confirmedByUserId_idx" ON "trip_payments"("confirmedByUserId");
