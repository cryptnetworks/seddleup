import { expect, test } from "@playwright/test";
import {
  configureTestAuthSettings,
  createTripWithParticipants,
  registerAndLogin,
  uniqueLabel
} from "./helpers";

test.beforeAll(() => {
  configureTestAuthSettings();
});

test("iPhone WebKit user can add and edit decimal expenses", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "Mobile Safari", "Mobile Safari regression coverage only.");

  await registerAndLogin(page, testInfo, "ios-expense");
  await createTripWithParticipants(page, uniqueLabel(testInfo, "iOS Trip"));

  await page.getByRole("link", { name: "Add Expense" }).first().tap();
  await page.getByLabel("Title").fill("iOS Coffee");
  await page.getByLabel("Amount").fill("12.50");
  await expect(page.getByTestId("expense-amount")).toHaveAttribute("inputmode", "decimal");
  await page.getByLabel("Date").fill("2026-07-02");
  await page.getByRole("button", { name: "Record expense" }).tap();

  await expect(page.getByText("iOS Coffee")).toBeVisible();
  await expect(page.getByText("$12.50").first()).toBeVisible();

  await page.getByRole("link", { name: "Edit iOS Coffee" }).tap();
  await expect(page.getByRole("heading", { name: "Edit expense" })).toBeVisible();
  await expect(page.getByTestId("expense-amount")).toHaveAttribute("inputmode", "decimal");
  await expect(page.getByTestId("expense-amount")).toHaveValue("12.50");

  await page.getByTestId("expense-title").fill("iOS Coffee Edited");
  await page.getByTestId("expense-amount").fill("18,75");
  await page.getByTestId("expense-submit").tap();

  await expect(page.getByText("iOS Coffee Edited")).toBeVisible();
  await expect(page.getByText("$18.75").first()).toBeVisible();
});

test("iPhone WebKit user can complete test SSO login", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "Mobile Safari", "Mobile Safari regression coverage only.");

  await page.goto("/api/auth/oauth/test/start");
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
});
