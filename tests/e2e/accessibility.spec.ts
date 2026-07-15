import { expect, test, type Locator } from "@playwright/test";
import {
  addParticipant,
  configureTestAuthSettings,
  registerAndLogin,
  uniqueLabel
} from "./helpers";

test.beforeAll(() => {
  configureTestAuthSettings();
});

test.beforeEach(({}, testInfo) => {
  test.skip(
    !["Chromium", "Mobile Safari"].includes(testInfo.project.name),
    "Focused accessibility matrix uses Chromium and Mobile Safari."
  );
});

async function expectVisibleFocus(locator: Locator) {
  await locator.focus();
  const hasVisibleFocus = await locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return style.boxShadow !== "none" || Number.parseFloat(style.outlineWidth) > 0;
  });
  expect(hasVisibleFocus).toBe(true);
}

test("login and registration expose labels, keyboard order, focus, and validation errors", async ({
  page
}, testInfo) => {
  await page.goto("/login");
  const email = page.getByLabel("Email");
  const password = page.getByLabel("Password");
  const submit = page.getByRole("button", { name: "Login" });

  await expect(email).toBeVisible();
  await expect(password).toBeVisible();
  await expectVisibleFocus(email);
  await email.press("Tab");
  await expect(password).toBeFocused();
  await password.press("Tab");
  if (testInfo.project.name === "Chromium") {
    await expect(submit).toBeFocused();
  } else {
    // Headless WebKit follows macOS's keyboard-access setting and may skip buttons on Tab.
    await expectVisibleFocus(submit);
  }

  await email.fill("missing-accessibility-user@triptally.test");
  await password.fill("wrong-password");
  await submit.click();
  const error = page.locator("#login-error");
  await expect(error).toHaveText("Invalid email or password.");
  await expect(email).toHaveAttribute("aria-describedby", "login-error");
  await expect(password).toHaveAttribute("aria-invalid", "true");

  await page.goto("/register");
  await expect(page.getByLabel("Username")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Confirm password")).toBeVisible();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByLabel("Username")).toBeFocused();
  expect(
    await page
      .getByLabel("Username")
      .evaluate((field) => (field as HTMLInputElement).checkValidity())
  ).toBe(false);
});

test("trip and expense create/edit forms remain keyboard and mobile usable", async ({
  page
}, testInfo) => {
  await registerAndLogin(page, testInfo, "accessibility");
  const tripName = uniqueLabel(testInfo, "Accessible Trip");
  await page.getByRole("link", { name: "Create Trip" }).click();
  await expect(page.getByLabel("Trip name")).toBeVisible();
  await expect(page.getByLabel("Destination")).toBeVisible();
  await page.getByLabel("Trip name").fill(tripName);
  await page.getByLabel("Destination").fill("Portland");
  await page.getByRole("button", { name: "Save trip" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: tripName })).toBeVisible();
  await addParticipant(page, "Alice", "alice-accessibility@example.com");
  await addParticipant(page, "Bob", "bob-accessibility@example.com");

  await page.getByRole("link", { name: "Add Expense" }).first().click();
  const title = page.getByLabel("Title");
  const amount = page.getByLabel("Amount");
  await expect(title).toBeVisible();
  await expect(amount).toBeVisible();
  await expect(page.getByRole("group", { name: "Shared by" })).toBeVisible();
  await expectVisibleFocus(title);

  await title.fill("Accessible dinner");
  await amount.fill("not-a-number");
  await page.getByRole("button", { name: "Record expense" }).click();
  await expect(amount).toBeFocused();
  expect(await amount.evaluate((field) => (field as HTMLInputElement).checkValidity())).toBe(false);

  await amount.fill("42.50");
  await page.getByRole("button", { name: "Record expense" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Accessible dinner")).toBeVisible();

  await page.getByRole("link", { name: "Edit Accessible dinner" }).click();
  await expect(page.getByLabel("Title")).toHaveValue("Accessible dinner");
  await page.getByLabel("Notes").fill("Keyboard-reviewed expense");
  await page.getByRole("button", { name: "Save expense" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Keyboard-reviewed expense")).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(hasHorizontalOverflow).toBe(false);
});
