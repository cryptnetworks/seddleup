import { expect, test } from "@playwright/test";
import {
  addExpense,
  configureTestAuthSettings,
  createTripWithParticipants,
  registerAndLogin,
  uniqueLabel
} from "./helpers";

test.skip(process.env.PLAYWRIGHT_SERVER_MODE !== "production", "Production server coverage only.");

test.beforeAll(() => {
  configureTestAuthSettings();
});

test("production server supports health, auth, trip, expense, logout, and authorization flows", async ({
  browser,
  page,
  request
}, testInfo) => {
  const readiness = await request.get("/api/health");
  expect(readiness.ok()).toBe(true);
  await expect(readiness.json()).resolves.toMatchObject({
    ok: true,
    data: { status: "ready" }
  });

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);

  const productionFlow = { followServerActionResponse: true };
  await registerAndLogin(page, testInfo, "production-smoke-owner", productionFlow);
  const tripName = uniqueLabel(testInfo, "Production Trip");
  await createTripWithParticipants(page, tripName, productionFlow);
  await addExpense(page, "Production dinner", "84.25", productionFlow);
  const tripPath = new URL(page.url()).pathname;

  const outsiderContext = await browser.newContext();
  const outsiderPage = await outsiderContext.newPage();
  await registerAndLogin(outsiderPage, testInfo, "production-smoke-outsider", productionFlow);
  await outsiderPage.goto(tripPath);
  await expect(
    outsiderPage.getByRole("heading", { name: "This page is not available." })
  ).toBeVisible();
  await outsiderContext.close();

  if (await page.getByTestId("account-menu-trigger").isVisible()) {
    await page.getByTestId("account-menu-trigger").click();
    await page.getByTestId("logout-button").click();
  } else {
    await page.getByTestId("mobile-nav-logout").click();
  }
  await expect(page).toHaveURL(/\/login\?logout=1/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});
