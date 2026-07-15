import { expect, test } from "@playwright/test";
import {
  configureTestAuthSettings,
  createTripWithParticipants,
  registerAndLogin,
  uniqueLabel
} from "./helpers";

const receiptsEnabled = process.env.RECEIPT_UPLOAD_ENABLED === "true";

test.beforeAll(() => {
  configureTestAuthSettings();
});

test("receipt upload UI is hidden when the feature flag is disabled", async ({
  page
}, testInfo) => {
  test.skip(receiptsEnabled, "Disabled-state coverage runs in the default E2E environment.");
  await registerAndLogin(page, testInfo, "receipts");
  await createTripWithParticipants(page, uniqueLabel(testInfo, "Receipt Trip"));

  await expect(page.getByRole("link", { name: "Upload Receipt" })).toHaveCount(0);
  await page.goto(`${page.url().replace(/\\?.*$/, "")}/receipts/new`);
  await expect(page.getByRole("heading", { name: "This page is not available." })).toBeVisible();
});

test("enabled receipt upload, review, file authorization, and cleanup path work", async ({
  browser,
  page,
  request
}, testInfo) => {
  test.skip(!receiptsEnabled, "Enabled receipt coverage uses the isolated receipt runner.");

  await registerAndLogin(page, testInfo, "receipt-owner");
  await createTripWithParticipants(page, uniqueLabel(testInfo, "Enabled Receipt Trip"));
  const tripPath = new URL(page.url()).pathname;

  await page.getByRole("link", { name: "Upload Receipt" }).click();
  await page.getByLabel("Receipt file").setInputFiles("tests/fixtures/receipt-sample.pdf");
  await page.getByRole("button", { name: "Upload and parse" }).click();
  await expect(page.getByRole("heading", { name: "Review receipt" })).toBeVisible();
  const receiptPath = new URL(page.url()).pathname;

  await expect(page.getByLabel("Merchant")).toHaveValue("SeddleUp Test Market");
  await expect(page.locator("#total")).toHaveValue("13.50");
  await page.getByLabel("Merchant").fill("SeddleUp Test Market");
  await page.locator("#total").fill("13.50");
  await page.getByLabel("Review status").selectOption("ready");
  await page.getByRole("button", { name: "Save review" }).click();
  await expect(page.getByText("Receipt review saved.")).toBeVisible();

  const filePath = await page.getByRole("link", { name: "Open receipt file" }).getAttribute("href");
  expect(filePath).toMatch(/^\/api\/receipts\/[^/]+\/file$/);
  const ownerFileResponse = await page.request.get(filePath ?? "");
  expect(ownerFileResponse.ok()).toBe(true);
  expect(ownerFileResponse.headers()["content-type"]).toBe("application/pdf");
  expect((await ownerFileResponse.body()).toString("utf8")).toContain("SeddleUp Test Market");

  const publicResponse = await request.get(filePath ?? "");
  expect(publicResponse.url()).toContain("/login");
  expect((await publicResponse.body()).toString("utf8")).not.toContain("SeddleUp Test Market");

  const outsiderContext = await browser.newContext();
  const outsiderPage = await outsiderContext.newPage();
  await registerAndLogin(outsiderPage, testInfo, "receipt-outsider");
  const outsiderFileResponse = await outsiderPage.request.get(filePath ?? "");
  expect(outsiderFileResponse.status()).toBe(404);
  await outsiderPage.goto(receiptPath);
  await expect(
    outsiderPage.getByRole("heading", { name: "This page is not available." })
  ).toBeVisible();
  await outsiderPage.goto(tripPath);
  await expect(
    outsiderPage.getByRole("heading", { name: "This page is not available." })
  ).toBeVisible();
  await outsiderContext.close();
});
