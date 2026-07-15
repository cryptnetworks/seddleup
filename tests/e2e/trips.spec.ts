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

test("creates and edits a trip", async ({ page }, testInfo) => {
  await registerAndLogin(page, testInfo, "trip");
  const tripName = uniqueLabel(testInfo, "Trip");
  await createTripWithParticipants(page, tripName);

  await page.getByTestId("edit-trip").click();
  await page.getByLabel("Destination").fill("Seattle");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Seattle")).toBeVisible();
  await expect(page.getByTestId("trip-activity")).toContainText("updated the trip details");
});
