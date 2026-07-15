import { expect, test } from "@playwright/test";
import { configureTestAuthSettings, registerAndLogin } from "./helpers";

test.beforeAll(() => {
  configureTestAuthSettings();
});

test("theme selection persists and updates semantic colors", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name.startsWith("Mobile"),
    "The theme control is in the desktop menu."
  );
  await registerAndLogin(page, testInfo, "theme");
  await page.evaluate(() => localStorage.setItem("theme", "light"));
  await page.goto("/account");

  const toggle = page.getByRole("complementary").getByTestId("theme-toggle");
  await expect(toggle).toHaveAccessibleName("Dark");
  await toggle.click();

  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(toggle).toHaveAccessibleName("Light");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("theme"))).toBe("dark");

  const profileField = page.getByLabel("Username");
  await profileField.focus();
  await expect
    .poll(() => profileField.evaluate((element) => getComputedStyle(element).boxShadow))
    .not.toBe("none");
  await expect
    .poll(() => profileField.evaluate((element) => getComputedStyle(element).fontSize))
    .toBe("16px");

  const darkColors = await page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement);
    return {
      background: styles.getPropertyValue("--app-background").trim(),
      primary: styles.getPropertyValue("--app-primary").trim()
    };
  });
  expect(darkColors).toEqual({ background: "#151c18", primary: "#83b49b" });

  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.getByRole("complementary").getByTestId("theme-toggle")).toHaveAccessibleName(
    "Light"
  );
});
