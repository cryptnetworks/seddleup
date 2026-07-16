import { access } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  configureTestAuthSettings,
  createTripWithParticipants,
  login,
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

  const owner = await registerAndLogin(page, testInfo, "receipt-owner");
  await createTripWithParticipants(page, uniqueLabel(testInfo, "Enabled Receipt Trip"));
  const tripPath = new URL(page.url()).pathname;

  await page.getByRole("link", { name: "Upload Receipt" }).click();
  await page.getByLabel("Receipt file").setInputFiles("tests/fixtures/receipt-sample.pdf");
  await page.getByRole("button", { name: "Upload and parse" }).click();
  await expect(page.getByRole("heading", { name: "Review receipt" })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    )
  ).toBe(false);
  const receiptPath = new URL(page.url()).pathname;
  const receiptId = receiptPath.split("/").at(-1) ?? "";
  const uploadRoot = process.env.PLAYWRIGHT_RECEIPT_UPLOAD_DIR ?? "";
  const storedReceiptDirectory = path.join(uploadRoot, receiptId);
  await expect(access(storedReceiptDirectory)).resolves.toBeUndefined();

  await expect(page.getByLabel("Merchant")).toHaveValue("SeddleUp Test Market");
  await expect(page.locator("#total")).toHaveValue("13.50");
  while ((await page.getByRole("button", { name: "Delete item" }).count()) > 0) {
    await page.getByRole("button", { name: "Delete item" }).first().click();
    await expect(page.getByText("Line items saved.")).toBeVisible();
  }
  await page.getByPlaceholder("Item name").fill("Shared snack");
  await page.getByPlaceholder("Total").fill("13.50");
  await page.locator('form:has-text("Add line item") input[name="participantIds"]').first().check();
  await page.getByRole("button", { name: "Add item" }).click();
  await expect(page.getByText("Line items saved.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Itemized split preview" })).toBeVisible();

  const staleReviewContext = await browser.newContext();
  const staleReviewPage = await staleReviewContext.newPage();
  await login(staleReviewPage, owner.email, owner.password);
  await staleReviewPage.goto(receiptPath);
  await expect(staleReviewPage.getByRole("heading", { name: "Review receipt" })).toBeVisible();
  await page.getByRole("button", { name: "Save item" }).click();
  await expect(page.getByText("Line items saved.")).toBeVisible();
  await staleReviewPage.getByRole("button", { name: "Save review" }).click();
  await expect(
    staleReviewPage.getByText("changed in another request", { exact: false })
  ).toBeVisible();
  await staleReviewContext.close();

  await page.getByLabel("Split mode").selectOption("itemized");
  await page.getByLabel("Merchant").fill("SeddleUp Test Market");
  await page.getByLabel("Date").fill("2026-07-02");
  await page.locator("#subtotal").fill("13.50");
  await page.locator("#tax").fill("0.00");
  await page.locator("#tip").fill("0.00");
  await page.locator("#adjustments").fill("0.00");
  await page.locator("#total").fill("13.50");
  await page.getByLabel("Paid by").selectOption({ label: "Alice" });
  await page.getByRole("button", { name: "Save review" }).click();
  await expect(page.getByText(/Confirm the refreshed split preview/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Itemized split preview" })).toBeVisible();
  await expect(page.getByText("Allocated $13.50", { exact: false })).toBeVisible();
  await page.getByLabel("Review status").selectOption("ready");
  await page.getByRole("button", { name: "Save review" }).click();
  await expect(page.getByText("Receipt review and linked expense saved.")).toBeVisible();

  // A repeated review updates the linked expense instead of duplicating the charge.
  await page.getByRole("button", { name: "Save review" }).click();
  await expect(page.getByText("Receipt review and linked expense saved.")).toBeVisible();
  await page.goto(tripPath);
  await expect(
    page.getByTestId("expense-card").filter({ hasText: "SeddleUp Test Market" })
  ).toHaveCount(1);
  await page.goto(receiptPath);

  await page.locator("#total").fill("-1.00");
  await page.locator("#total").evaluate((element) => element.removeAttribute("pattern"));
  await page.getByRole("button", { name: "Save review" }).click();
  await expect(page.locator("#total")).toHaveAttribute("aria-invalid", "true");
  await expect(
    page.getByText("Enter a valid non-negative USD amount with at most two decimal places.")
  ).toBeVisible();

  const filePath = await page.getByRole("link", { name: "Open receipt file" }).getAttribute("href");
  expect(filePath).toMatch(/^\/api\/receipts\/[^/]+\/file$/);
  const ownerFileResponse = await page.request.get(filePath ?? "");
  expect(ownerFileResponse.ok()).toBe(true);
  expect(ownerFileResponse.headers()["content-type"]).toBe("application/pdf");
  expect(ownerFileResponse.headers()["cache-control"]).toBe("private, no-store, max-age=0");
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

  await page.goto(receiptPath);
  await page.getByRole("button", { name: "Delete receipt" }).click();
  await expect(page.getByRole("heading", { name: "Expense history" })).toBeVisible();
  await expect(access(storedReceiptDirectory)).rejects.toMatchObject({ code: "ENOENT" });
  expect((await page.request.get(filePath ?? "")).status()).toBe(404);

  await page.getByRole("link", { name: "Upload Receipt" }).click();
  await page.getByLabel("Receipt file").setInputFiles("tests/fixtures/receipt-sample.pdf");
  await page.getByRole("button", { name: "Upload and parse" }).click();
  await expect(page.getByRole("heading", { name: "Review receipt" })).toBeVisible();
  const parentDeleteReceiptId = new URL(page.url()).pathname.split("/").at(-1) ?? "";
  const parentDeleteDirectory = path.join(uploadRoot, parentDeleteReceiptId);
  await expect(access(parentDeleteDirectory)).resolves.toBeUndefined();
  await page.goto(tripPath);
  await page.getByTestId("delete-trip").click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(access(parentDeleteDirectory)).rejects.toMatchObject({ code: "ENOENT" });
});
