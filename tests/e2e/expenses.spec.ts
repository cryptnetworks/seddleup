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
});

test("accepts comma decimal amounts from mobile keyboards", async ({ page }, testInfo) => {
  await registerAndLogin(page, testInfo, "expense-comma");
  await createTripWithParticipants(page, uniqueLabel(testInfo, "Comma Trip"));

  await addExpense(page, "Pastries", "9,75");
  await expect(page.getByText("$9.75").first()).toBeVisible();
});

test("rejects manipulated expense precision on the server", async ({ page }, testInfo) => {
  await registerAndLogin(page, testInfo, "expense-precision");
  await createTripWithParticipants(page, uniqueLabel(testInfo, "Precision Trip"));

  await page.getByTestId("add-expense").click();
  await page.getByTestId("expense-title").fill("Manipulated total");
  await page.getByTestId("expense-amount").fill("10.001");
  await page
    .getByTestId("expense-amount")
    .evaluate((element) => element.removeAttribute("pattern"));
  await page.getByTestId("expense-submit").click();

  await expect(page.getByTestId("expense-amount")).toHaveAttribute("aria-invalid", "true");
  await expect(
    page.getByText("Enter a valid USD amount with at most two decimal places.")
  ).toBeVisible();
});
