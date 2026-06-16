import { expect, type Page, type TestInfo } from "@playwright/test";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";

export function sqliteDatabasePath() {
  const databaseUrl = process.env.DATABASE_URL ?? "file:./playwright.db";
  if (!databaseUrl.startsWith("file:")) {
    throw new Error("E2E helpers expect a SQLite DATABASE_URL.");
  }
  const rawPath = databaseUrl.replace(/^file:/, "");
  return path.isAbsolute(rawPath) ? rawPath : path.resolve(rawPath);
}

export function configureTestAuthSettings() {
  const db = new DatabaseSync(sqliteDatabasePath(), { timeout: 5000 });
  try {
    db.exec("PRAGMA busy_timeout = 5000");
    for (const [key, value] of [
      ["requireEmailVerification", "false"],
      ["localAuthEnabled", "true"],
      ["publicRegistrationEnabled", "true"],
      ["allowedEmailDomains", ""],
      ["defaultUserRole", "user"]
    ]) {
      db.prepare(
        `INSERT INTO app_settings (key, value, updatedAt)
         VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP`
      ).run(key, value);
    }
  } finally {
    db.close();
  }
}

export function uniqueLabel(testInfo: TestInfo, prefix: string) {
  return `${prefix}-${testInfo.project.name.replaceAll(/\W+/g, "-").toLowerCase()}-${Date.now()}-${testInfo.retry}`;
}

export async function registerAndLogin(page: Page, testInfo: TestInfo, prefix = "e2e") {
  const label = uniqueLabel(testInfo, prefix);
  const user = {
    username: label.slice(0, 70),
    email: `${label}@triptally.test`,
    password: "TestPass123"
  };

  await page.goto("/register");
  await page.getByLabel("Username").fill(user.username);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByLabel("Confirm password").fill(user.password);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/login/);
  await login(page, user.email, user.password);
  return user;
}

export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

export async function createTripWithParticipants(page: Page, name: string) {
  await page.getByRole("link", { name: "Create Trip" }).click();
  await page.getByLabel("Trip name").fill(name);
  await page.getByLabel("Destination").fill("Portland");
  await page.getByLabel("Start date").fill("2026-07-01");
  await page.getByLabel("End date").fill("2026-07-04");
  await page.getByRole("button", { name: "Save trip" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();

  for (const participant of ["Alice", "Bob"]) {
    await addParticipant(page, participant, `${participant.toLowerCase()}@example.com`);
  }
}

export async function addParticipant(page: Page, name: string, email: string) {
  await page.getByTestId("participant-name").fill(name);
  await page.getByTestId("participant-email").fill(email);
  await page.getByTestId("participant-submit").click();
  await expect(page.getByTestId("participant-card").filter({ hasText: name })).toBeVisible();
}

export async function addExpense(page: Page, title: string, amount: string) {
  await page.getByRole("link", { name: "Add Expense" }).first().click();
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Amount").fill(amount);
  await page.getByLabel("Date").fill("2026-07-02");
  await page.getByRole("button", { name: "Record expense" }).click();
  await expect(page.getByText(title)).toBeVisible();
}
