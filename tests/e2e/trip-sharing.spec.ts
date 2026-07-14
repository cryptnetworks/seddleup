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

test("manager creates, views, rotates, and revokes a responsive read-only link", async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name !== "Chromium", "Covered once with a responsive viewport.");
  await page.setViewportSize({ width: 390, height: 844 });
  await registerAndLogin(page, testInfo, "trip-sharing");
  const tripName = uniqueLabel(testInfo, "Shared Costs");
  await createTripWithParticipants(page, tripName);
  await addExpense(page, "Shared dinner", "48.00");

  await page.getByTestId("share-trip").click();
  await expect(page.getByRole("heading", { name: "Share read-only trip costs" })).toBeVisible();
  const managementUrl = page.url();
  await page.getByTestId("trip-share-create-or-rotate").click();
  const firstUrl = await page.getByLabel("New sharing URL").inputValue();
  expect(firstUrl).toMatch(/\/share\/trip\/[A-Za-z0-9_-]{43}$/);

  const firstResponse = await page.request.get(firstUrl);
  expect(firstResponse.headers()["x-robots-tag"]).toContain("noindex");
  expect(firstResponse.headers()["referrer-policy"]).toBe("no-referrer");
  expect(firstResponse.headers()["cache-control"]).toMatch(/no-store|no-cache/);

  await page.goto(firstUrl);
  await expect(page.getByRole("heading", { name: tripName })).toBeVisible();
  await expect(page.getByText("Shared dinner")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Traveler 1", exact: true })).toBeVisible();
  await expect(page.locator("form")).toHaveCount(0);
  await expect(page.getByRole("link")).toHaveCount(0);

  await page.goto(managementUrl);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByTestId("trip-share-create-or-rotate").click();
  const rotatedUrl = await page.getByLabel("New sharing URL").inputValue();
  expect(rotatedUrl).not.toBe(firstUrl);

  await page.goto(firstUrl);
  await expect(page.getByTestId("share-unavailable")).toBeVisible();
  await page.goto(rotatedUrl);
  await expect(page.getByRole("heading", { name: tripName })).toBeVisible();

  await page.goto(managementUrl);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByTestId("trip-share-revoke").click();
  await expect(page.getByRole("heading", { name: "Create sharing link" })).toBeVisible();
  await page.goto(rotatedUrl);
  await expect(page.getByTestId("share-unavailable")).toBeVisible();
});
