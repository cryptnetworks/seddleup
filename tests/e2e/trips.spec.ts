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

test("creates and edits a trip", async ({ page }, testInfo) => {
  await registerAndLogin(page, testInfo, "trip");
  const tripName = uniqueLabel(testInfo, "Trip");
  await createTripWithParticipants(page, tripName);

  await page.getByTestId("edit-trip").click();
  await page.getByLabel("Destination").fill("Seattle");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Seattle")).toBeVisible();
});

test("explains why a participant with financial history cannot be deleted", async ({
  page
}, testInfo) => {
  await registerAndLogin(page, testInfo, "participant-delete");
  await createTripWithParticipants(page, uniqueLabel(testInfo, "Protected participant trip"));
  await addExpense(page, "Protected dinner", "12.00");

  await expect(page.getByText("Financial history retained")).toHaveCount(2);
  await page.getByTestId("participant-edit").first().click();
  await expect(
    page.getByText(/This participant cannot be deleted because financial history references them/)
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Delete/ })).toHaveCount(0);
});
