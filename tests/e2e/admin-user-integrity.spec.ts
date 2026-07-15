import { DatabaseSync } from "node:sqlite";
import { expect, test, type Page } from "@playwright/test";
import {
  configureTestAuthSettings,
  createTripWithParticipants,
  registerAndLogin,
  sqliteDatabasePath,
  uniqueLabel
} from "./helpers";

function setAdmin(email: string) {
  const database = new DatabaseSync(sqliteDatabasePath(), { timeout: 5000 });
  try {
    database
      .prepare("UPDATE users SET role = 'admin', updatedAt = CURRENT_TIMESTAMP WHERE email = ?")
      .run(email);
  } finally {
    database.close();
  }
}

test.beforeAll(() => {
  configureTestAuthSettings();
});

function userCard(page: Page, email: string) {
  return page
    .getByTestId("admin-user-card")
    .filter({ has: page.getByRole("heading", { name: email, exact: true }) });
}

test("admin transfers an owned trip before deleting its former owner", async ({
  browser,
  page
}, testInfo) => {
  test.setTimeout(60_000);
  const admin = await registerAndLogin(page, testInfo, "integrity-admin");
  setAdmin(admin.email);

  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  const owner = await registerAndLogin(ownerPage, testInfo, "integrity-owner");
  const tripNames = [
    uniqueLabel(testInfo, "Transferred trip one"),
    uniqueLabel(testInfo, "Transferred trip two")
  ];
  for (const [index, tripName] of tripNames.entries()) {
    if (index > 0) await ownerPage.goto("/trips");
    await createTripWithParticipants(ownerPage, tripName);
  }
  await ownerContext.close();

  const replacementContext = await browser.newContext();
  const replacementPage = await replacementContext.newPage();
  const replacement = await registerAndLogin(replacementPage, testInfo, "integrity-replacement");
  await replacementContext.close();

  await page.goto("/admin/users");
  let ownerCard = userCard(page, owner.email);
  await expect(ownerCard.getByText(/Transfer 2 owned trip/).first()).toBeVisible();
  await expect(ownerCard.getByRole("button", { name: "Delete" })).toBeDisabled();
  for (const [index, tripName] of tripNames.entries()) {
    const transferForm = ownerCard.locator("form").filter({ hasText: tripName });
    const replacementValue = await transferForm
      .locator("option")
      .filter({ hasText: replacement.email })
      .getAttribute("value");
    await transferForm
      .locator('select[name="replacementOwnerId"]')
      .selectOption(replacementValue ?? "");
    await transferForm.getByRole("button", { name: "Transfer ownership" }).click();
    await expect(page.getByText("Trip ownership transferred.")).toBeVisible();
    ownerCard = userCard(page, owner.email);
    await expect(ownerCard.getByText(new RegExp(`Transfer ${1 - index} owned trip`))).toHaveCount(
      index === 0 ? 1 : 0
    );
  }

  await ownerCard.getByRole("button", { name: "Delete" }).click();
  await expect(userCard(page, owner.email)).toHaveCount(0);

  const replacementContextAfter = await browser.newContext();
  const replacementPageAfter = await replacementContextAfter.newPage();
  await replacementPageAfter.goto("/login");
  await replacementPageAfter.getByLabel("Email").fill(replacement.email);
  await replacementPageAfter.getByLabel("Password").fill(replacement.password);
  await replacementPageAfter.getByRole("button", { name: "Login" }).click();
  for (const tripName of tripNames) {
    await expect(replacementPageAfter.getByText(tripName)).toBeVisible();
  }
  await replacementContextAfter.close();

  const adminCard = userCard(page, admin.email);
  await adminCard.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Action blocked: self-lockout.")).toBeVisible();
});
