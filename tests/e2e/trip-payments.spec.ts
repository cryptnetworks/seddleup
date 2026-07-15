import { expect, test } from "@playwright/test";
import * as bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import {
  addExpense,
  configureTestAuthSettings,
  createTripWithParticipants,
  login,
  registerAndLogin,
  sqliteDatabasePath,
  uniqueLabel
} from "./helpers";

test.beforeAll(() => {
  configureTestAuthSettings();
});

async function addLinkedTripUser(
  tripId: string,
  role: "member" | "viewer",
  label: string,
  participantName: string
) {
  const password = "TestPass123";
  const user = {
    id: randomUUID(),
    username: `${role}-${label}`.slice(0, 78),
    email: `${role}-${label}@seddleup.test`,
    password
  };
  const now = new Date().toISOString();
  const db = new DatabaseSync(sqliteDatabasePath(), { timeout: 5000 });
  try {
    db.exec("PRAGMA foreign_keys = ON");
    db.prepare(
      `INSERT INTO users (id, username, email, passwordHash, role, emailVerifiedAt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, 'user', ?, ?, ?)`
    ).run(user.id, user.username, user.email, await bcrypt.hash(password, 12), now, now, now);
    db.prepare(
      `INSERT INTO trip_members (id, role, createdAt, updatedAt, tripId, userId)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(randomUUID(), role, now, now, tripId, user.id);
    db.prepare(
      `UPDATE participants SET email = ?, userId = ?, updatedAt = ?
       WHERE tripId = ? AND name = ?`
    ).run(user.email, user.id, now, tripId, participantName);
  } finally {
    db.close();
  }
  return user;
}

function linkParticipantToUser(tripId: string, participantName: string, userEmail: string) {
  const db = new DatabaseSync(sqliteDatabasePath(), { timeout: 5000 });
  try {
    db.exec("PRAGMA foreign_keys = ON");
    const user = db.prepare("SELECT id FROM users WHERE email = ?").get(userEmail) as
      { id: string } | undefined;
    if (!user) throw new Error("Expected the registered E2E user to exist");
    db.prepare(
      `UPDATE participants SET userId = ?, updatedAt = CURRENT_TIMESTAMP
       WHERE tripId = ? AND name = ?`
    ).run(user.id, tripId, participantName);
  } finally {
    db.close();
  }
}

function insertConfirmedPayment(tripId: string, senderName: string, recipientName: string) {
  const db = new DatabaseSync(sqliteDatabasePath(), { timeout: 5000 });
  try {
    db.exec("PRAGMA foreign_keys = ON");
    const sender = db
      .prepare("SELECT id FROM participants WHERE tripId = ? AND name = ?")
      .get(tripId, senderName) as { id: string } | undefined;
    const recipient = db
      .prepare("SELECT id, userId FROM participants WHERE tripId = ? AND name = ?")
      .get(tripId, recipientName) as { id: string; userId: string | null } | undefined;
    if (!sender || !recipient?.userId) {
      throw new Error("Expected linked E2E payment participants to exist");
    }
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO trip_payments
       (id, amount, date, createdAt, updatedAt, tripId, senderParticipantId,
        recipientParticipantId, confirmedByUserId, confirmedAt)
       VALUES (?, '1.00', ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(randomUUID(), now, now, now, tripId, sender.id, recipient.id, recipient.userId, now);
  } finally {
    db.close();
  }
}

test("lets only the linked creditor confirm and manage a suggested settlement", async ({
  page
}, testInfo) => {
  const owner = await registerAndLogin(page, testInfo, "trip-payment-owner");
  await createTripWithParticipants(page, uniqueLabel(testInfo, "Settlement Trip"));
  const tripId = new URL(page.url()).pathname.split("/")[2];
  linkParticipantToUser(tripId, "Alice", owner.email);

  await addExpense(page, "Shared lodging", "100.00");
  const suggestion = page.getByTestId("settlement-card").filter({ hasText: "Bob owes Alice" });
  await suggestion.getByRole("link", { name: "Confirm payment received" }).click();
  await expect(page.getByText("Paid by")).toBeVisible();
  await expect(page.getByText("Received by")).toBeVisible();
  await expect(page.getByLabel("Amount received (USD)")).toHaveValue("50.00");
  await page.getByLabel("Amount received (USD)").fill("20.00");
  await page.getByLabel("Note (optional)").fill("Completed transfer");
  await page.getByRole("button", { name: "Confirm payment received" }).click();

  await expect(page.getByTestId("trip-payment-card")).toContainText(
    "Alice confirmed receiving $20.00 from Bob"
  );
  await expect(page.getByTestId("trip-activity")).toContainText("Confirmed a payment received");
  await expect(page.getByTestId("settlement-card")).toContainText("$30.00");
  await page.getByRole("link", { name: "Edit confirmation" }).click();
  await expect(page.getByLabel("Amount received (USD)")).toHaveCount(0);
  await page.getByLabel("Note (optional)").fill("Corrected note only");
  await page.getByRole("button", { name: "Save confirmation details" }).click();
  await expect(page.getByTestId("trip-payment-card")).toContainText("$20.00");
  await expect(page.getByTestId("trip-activity")).toContainText("Updated a payment confirmation");

  await page.getByRole("link", { name: "Edit confirmation" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete payment confirmation" }).click();
  await expect(page.getByText("No payments have been confirmed yet.")).toBeVisible();
  await expect(page.getByTestId("settlement-card")).toContainText("$50.00");
  await expect(page.getByTestId("trip-activity")).toContainText("Deleted a payment confirmation");

  const member = await addLinkedTripUser(tripId, "member", uniqueLabel(testInfo, "member"), "Bob");
  await page.context().clearCookies();
  await login(page, member.email, member.password);
  await page.goto(`/trips/${tripId}`);
  await expect(page.getByTestId("settlement-card")).toContainText("Bob owes Alice");
  await expect(page.getByRole("link", { name: "Confirm payment received" })).toHaveCount(0);

  const viewer = await addLinkedTripUser(
    tripId,
    "viewer",
    uniqueLabel(testInfo, "viewer"),
    "Alice"
  );
  await page.context().clearCookies();
  await login(page, viewer.email, viewer.password);
  await page.goto(`/trips/${tripId}`);
  await expect(page.getByRole("link", { name: "Confirm payment received" })).toHaveCount(0);
  await expect(page.getByTestId("trip-payment-history")).toBeVisible();
  const noHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth
  );
  expect(noHorizontalOverflow).toBe(true);
});

test("retains participants referenced only by confirmed payments", async ({ page }, testInfo) => {
  const owner = await registerAndLogin(page, testInfo, "trip-payment-integrity");
  await createTripWithParticipants(page, uniqueLabel(testInfo, "Payment Integrity Trip"));
  const tripId = new URL(page.url()).pathname.split("/")[2];
  linkParticipantToUser(tripId, "Alice", owner.email);
  insertConfirmedPayment(tripId, "Bob", "Alice");

  await page.reload();
  const alice = page.getByTestId("participant-card").filter({ hasText: "Alice" });
  const bob = page.getByTestId("participant-card").filter({ hasText: "Bob" });
  await expect(alice).toContainText("Financial history retained");
  await expect(bob).toContainText("Financial history retained");
  await expect(page.getByRole("button", { name: "Delete Alice" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Delete Bob" })).toHaveCount(0);

  await alice.getByRole("link", { name: "Edit" }).click();
  await expect(page.getByText("1 payment received")).toBeVisible();
  await page.goto(`/trips/${tripId}`);
  await bob.getByRole("link", { name: "Edit" }).click();
  await expect(page.getByText("1 payment sent")).toBeVisible();
});
