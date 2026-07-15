-- Prevent participant deletion from cascading into expense and receipt history.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_expense_shares" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shareAmount" DECIMAL NOT NULL,
    "expenseId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    CONSTRAINT "expense_shares_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "expenses" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "expense_shares_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "participants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_expense_shares" ("expenseId", "id", "participantId", "shareAmount")
SELECT "expenseId", "id", "participantId", "shareAmount" FROM "expense_shares";
DROP TABLE "expense_shares";
ALTER TABLE "new_expense_shares" RENAME TO "expense_shares";
CREATE INDEX "expense_shares_participantId_idx" ON "expense_shares"("participantId");
CREATE UNIQUE INDEX "expense_shares_expenseId_participantId_key" ON "expense_shares"("expenseId", "participantId");

CREATE TABLE "new_expenses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "category" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "payerId" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "paidByUserId" TEXT,
    "updatedByUserId" TEXT,
    CONSTRAINT "expenses_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "participants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "expenses_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "expenses_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "expenses_paidByUserId_fkey" FOREIGN KEY ("paidByUserId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "expenses_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_expenses" ("amount", "category", "createdAt", "createdByUserId", "date", "id", "notes", "paidByUserId", "payerId", "status", "title", "tripId", "updatedAt", "updatedByUserId")
SELECT "amount", "category", "createdAt", "createdByUserId", "date", "id", "notes", "paidByUserId", "payerId", "status", "title", "tripId", "updatedAt", "updatedByUserId" FROM "expenses";
DROP TABLE "expenses";
ALTER TABLE "new_expenses" RENAME TO "expenses";
CREATE INDEX "expenses_tripId_idx" ON "expenses"("tripId");
CREATE INDEX "expenses_payerId_idx" ON "expenses"("payerId");
CREATE INDEX "expenses_createdByUserId_idx" ON "expenses"("createdByUserId");
CREATE INDEX "expenses_paidByUserId_idx" ON "expenses"("paidByUserId");
CREATE INDEX "expenses_updatedByUserId_idx" ON "expenses"("updatedByUserId");
CREATE INDEX "expenses_tripId_status_idx" ON "expenses"("tripId", "status");

CREATE TABLE "new_receipt_line_item_participants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "role" TEXT NOT NULL,
    "lineItemId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    CONSTRAINT "receipt_line_item_participants_lineItemId_fkey" FOREIGN KEY ("lineItemId") REFERENCES "receipt_line_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "receipt_line_item_participants_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "participants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_receipt_line_item_participants" ("id", "lineItemId", "participantId", "role")
SELECT "id", "lineItemId", "participantId", "role" FROM "receipt_line_item_participants";
DROP TABLE "receipt_line_item_participants";
ALTER TABLE "new_receipt_line_item_participants" RENAME TO "receipt_line_item_participants";
CREATE INDEX "receipt_line_item_participants_participantId_idx" ON "receipt_line_item_participants"("participantId");
CREATE UNIQUE INDEX "receipt_line_item_participants_lineItemId_participantId_role_key" ON "receipt_line_item_participants"("lineItemId", "participantId", "role");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
