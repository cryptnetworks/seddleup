import { expect, test, type Page } from "@playwright/test";
import { configureTestAuthSettings, registerAndLogin } from "./helpers";

test.beforeAll(() => {
  configureTestAuthSettings();
});

function containsSetupMaterial(value: string, secret: string) {
  const normalized = value.toLowerCase();
  return (
    normalized.includes("authenticatorsecret") ||
    normalized.includes("otpauth://") ||
    (secret.length > 0 && value.includes(secret))
  );
}

async function renderedNavigationTargets(page: Page) {
  return page.locator("a[href], form[action]").evaluateAll((elements) =>
    elements.map((element) => {
      if (element instanceof HTMLAnchorElement) return element.href;
      if (element instanceof HTMLFormElement) return element.action;
      return "";
    })
  );
}

test("keeps authenticator setup material out of browser navigation", async ({ page }, testInfo) => {
  const observedNavigation: string[] = [];

  page.on("request", (request) => {
    if (request.isNavigationRequest()) observedNavigation.push(request.url());
  });
  page.on("response", (response) => {
    const headers = response.headers();
    for (const header of [headers.location, headers["x-action-redirect"]]) {
      if (header) observedNavigation.push(header);
    }
  });

  await registerAndLogin(page, testInfo, "mfa-url-security");
  await page.goto("/account");
  await page.getByRole("button", { name: "Generate setup key" }).click();

  await expect(page).toHaveURL(/\/account\?twoFactor=authenticator-setup$/);

  const secretElement = page.getByTestId("authenticator-setup-secret");
  const uriElement = page.getByTestId("authenticator-setup-uri");
  await expect(secretElement).toBeVisible();
  await expect(uriElement).toBeVisible();

  const secret = (await secretElement.textContent())?.trim() ?? "";
  const uri = (await uriElement.textContent())?.trim() ?? "";
  expect(secret.length).toBeGreaterThan(0);
  expect(uri.startsWith("otpauth://")).toBe(true);

  const visibleTargets = await renderedNavigationTargets(page);
  const navigationLeak = [...observedNavigation, ...visibleTargets, page.url()].some((value) =>
    containsSetupMaterial(value, secret)
  );

  // Keep the generated seed out of assertion output even if this regression fails.
  expect(navigationLeak).toBe(false);
});
