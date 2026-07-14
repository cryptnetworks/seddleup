import { expect, test } from "@playwright/test";

test("public pages and protected redirect load", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.locator("header").getByRole("link", { name: "Login", exact: true })
  ).toBeVisible();

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});
