import { expect, test } from "@playwright/test";
import {
  addExpense,
  configureTestAuthSettings,
  createTripWithParticipants,
  registerAndLogin,
  uniqueLabel
} from "./helpers";

test.beforeAll(() => {
  configureTestAuthSettings();
});

test("adds an expense and updates balances", async ({ page }, testInfo) => {
  await registerAndLogin(page, testInfo, "expense");
  await createTripWithParticipants(page, uniqueLabel(testInfo, "Expense Trip"));

  await addExpense(page, "Coffee", "12.50");
  await expect(page.getByText("$12.50").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Balances" })).toBeVisible();
  await expect(page.getByTestId("trip-activity")).toContainText("added the expense “Coffee”");
  await expect(page.getByTestId("trip-activity")).toContainText(
    "$12.50 · Transportation · Submitted"
  );
});

test("accepts comma decimal amounts from mobile keyboards", async ({ page }, testInfo) => {
  await registerAndLogin(page, testInfo, "expense-comma");
  await createTripWithParticipants(page, uniqueLabel(testInfo, "Comma Trip"));

  await addExpense(page, "Pastries", "9,75");
  await expect(page.getByText("$9.75").first()).toBeVisible();
});
