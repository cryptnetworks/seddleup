import { DatabaseSync } from "node:sqlite";
import { expect, test, type Page } from "@playwright/test";
import { configureTestAuthSettings, registerAndLogin, sqliteDatabasePath } from "./helpers";

function updateUser(email: string, values: { admin?: boolean; mfa?: boolean }) {
  const database = new DatabaseSync(sqliteDatabasePath(), { timeout: 5000 });
  try {
    if (values.admin) {
      database.prepare("UPDATE users SET role = 'admin' WHERE email = ?").run(email);
    }
    if (values.mfa) {
      database
        .prepare(
          "UPDATE users SET twoFactorMethod = 'email', authenticatorEnabled = 0 WHERE email = ?"
        )
        .run(email);
    }
  } finally {
    database.close();
  }
}

function userCard(page: Page, email: string) {
  return page
    .getByTestId("admin-user-card")
    .filter({ has: page.getByRole("heading", { name: email, exact: true }) });
}

test.beforeAll(() => configureTestAuthSettings());

test("an administrator explicitly confirms an MFA reset and revokes the target session", async ({
  browser,
  page
}, testInfo) => {
  const admin = await registerAndLogin(page, testInfo, "mfa-recovery-admin");
  updateUser(admin.email, { admin: true });

  const targetContext = await browser.newContext();
  const targetPage = await targetContext.newPage();
  const target = await registerAndLogin(targetPage, testInfo, "mfa-recovery-target");
  updateUser(target.email, { mfa: true });

  await page.goto("/admin/users");
  let card = userCard(page, target.email);
  await expect(card.getByText("MFA: email")).toBeVisible();
  await card.getByLabel(`Enter ${target.username} to confirm MFA reset`).fill("wrong-user");
  await card.getByRole("button", { name: "Reset MFA" }).click();
  await expect(page.getByText(/enter the exact username/i)).toBeVisible();

  card = userCard(page, target.email);
  await card.getByLabel(`Enter ${target.username} to confirm MFA reset`).fill(target.username);
  await card.getByRole("button", { name: "Reset MFA" }).click();
  await expect(page.getByText(/authentication reset and active sessions revoked/i)).toBeVisible();
  await expect(userCard(page, target.email).getByText("MFA: Not configured")).toBeVisible();

  await targetPage.goto("/account");
  await expect(targetPage).toHaveURL(/\/login/);
  await targetContext.close();
});
