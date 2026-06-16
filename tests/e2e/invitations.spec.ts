import crypto from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import {
  addParticipant,
  configureTestAuthSettings,
  createTripWithParticipants,
  login,
  registerAndLogin,
  sqliteDatabasePath,
  uniqueLabel
} from "./helpers";

const SQLITE_BUSY_RETRIES = 5;

function digestToken(token: string) {
  return crypto
    .createHmac("sha256", process.env.TOKEN_DIGEST_SECRET || "playwright-token-digest-secret")
    .update(token)
    .digest("hex");
}

function readFromDb<T>(sql: string, ...params: SQLInputValue[]) {
  const db = new DatabaseSync(sqliteDatabasePath(), { timeout: 5000 });
  try {
    db.exec("PRAGMA busy_timeout = 5000");
    return db.prepare(sql).get(...params) as T;
  } finally {
    db.close();
  }
}

function writeToDb(sql: string, ...params: SQLInputValue[]) {
  const db = new DatabaseSync(sqliteDatabasePath(), { timeout: 5000 });
  try {
    db.exec("PRAGMA busy_timeout = 5000");
    return db.prepare(sql).run(...params);
  } finally {
    db.close();
  }
}

async function dbValue<T>(sql: string, ...params: SQLInputValue[]) {
  for (let attempt = 1; attempt <= SQLITE_BUSY_RETRIES; attempt += 1) {
    try {
      return readFromDb<T>(sql, ...params);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("database is locked")) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 100));
    }
  }
  return readFromDb<T>(sql, ...params);
}

async function dbRun(sql: string, ...params: SQLInputValue[]) {
  for (let attempt = 1; attempt <= SQLITE_BUSY_RETRIES; attempt += 1) {
    try {
      return writeToDb(sql, ...params);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("database is locked")) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 100));
    }
  }
  return writeToDb(sql, ...params);
}

async function clearSignedInSession(page: Page) {
  await page.context().clearCookies();
}

test.beforeEach(() => {
  configureTestAuthSettings();
});

test("admin can invite a user from Admin Users", async ({ page }, testInfo) => {
  const admin = await registerAndLogin(page, testInfo, "admin-invite");
  const inviteEmail = `${uniqueLabel(testInfo, "pending-user")}@seddleup.test`;
  await dbRun(
    "UPDATE users SET role = 'admin', updatedAt = CURRENT_TIMESTAMP WHERE email = ?",
    admin.email
  );

  await page.goto("/admin/users");
  await page.getByPlaceholder("Email address").fill(inviteEmail);
  await page.getByPlaceholder("Display name optional").fill("Pending User");
  await page.getByRole("button", { name: "Invite user" }).click();

  await expect(page.getByText("Invitation sent.")).toBeVisible();
  await expect(page.getByRole("heading", { name: inviteEmail })).toBeVisible();
  const invite = await dbValue<{ status: string; invitedByUserId: string }>(
    "SELECT status, invitedByUserId FROM invitations WHERE email = ?",
    inviteEmail
  );
  const adminRow = await dbValue<{ id: string }>(
    "SELECT id FROM users WHERE email = ?",
    admin.email
  );
  expect(invite).toMatchObject({ status: "pending", invitedByUserId: adminRow.id });
});

test("adding a non-user email to a trip creates a pending trip invite", async ({
  page
}, testInfo) => {
  await registerAndLogin(page, testInfo, "trip-invite-owner");
  const tripName = uniqueLabel(testInfo, "Trip Invite");
  const inviteEmail = `${uniqueLabel(testInfo, "trip-non-user")}@seddleup.test`;

  await createTripWithParticipants(page, tripName);
  await addParticipant(page, "Pending Traveler", inviteEmail);

  const invite = await dbValue<{ status: string; tripId: string }>(
    "SELECT status, tripId FROM invitations WHERE email = ?",
    inviteEmail
  );
  const trip = await dbValue<{ id: string }>("SELECT id FROM trips WHERE name = ?", tripName);
  expect(invite).toMatchObject({ status: "pending", tripId: trip.id });
});

test("invitee can accept a trip invite and join the trip", async ({ page }, testInfo) => {
  await registerAndLogin(page, testInfo, "accept-owner");
  const tripName = uniqueLabel(testInfo, "Accepted Trip");
  const inviteEmail = `${uniqueLabel(testInfo, "accept-user")}@seddleup.test`;
  const token = `playwright-invite-token-${Date.now()}-${testInfo.retry}`;

  await createTripWithParticipants(page, tripName);
  await addParticipant(page, "Accepted Traveler", inviteEmail);
  const trip = await dbValue<{ id: string }>("SELECT id FROM trips WHERE name = ?", tripName);
  const updateResult = await dbRun(
    `UPDATE invitations
     SET tokenHash = ?, expiresAt = datetime('now', '+7 days'), updatedAt = CURRENT_TIMESTAMP
     WHERE email = ? AND tripId = ? AND status = 'pending'`,
    digestToken(token),
    inviteEmail,
    trip.id
  );
  expect(updateResult.changes).toBe(1);

  await clearSignedInSession(page);

  await page.goto(`/invite/accept?token=${encodeURIComponent(token)}`);
  await expect(page.getByText(`for ${tripName}`)).toBeVisible();
  await page.getByLabel("Username").fill(uniqueLabel(testInfo, "accepted").slice(0, 70));
  await page.getByLabel("Password", { exact: true }).fill("TestPass123");
  await page.getByLabel("Confirm password").fill("TestPass123");
  await page.getByRole("button", { name: "Create account and accept" }).click();
  await expect(page).toHaveURL(/\/login/);

  await login(page, inviteEmail, "TestPass123");
  await expect(page.getByText(tripName)).toBeVisible();
  const membership = await dbValue<{ role: string }>(
    `SELECT trip_members.role FROM trip_members
     JOIN users ON users.id = trip_members.userId
     WHERE users.email = ? AND trip_members.tripId = ?`,
    inviteEmail,
    trip.id
  );
  expect(membership).toMatchObject({ role: "member" });
});
