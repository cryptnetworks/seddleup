import { expect, test } from "@playwright/test";

test("public pages and protected redirect load", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.locator("header").getByRole("link", { name: "Login", exact: true })
  ).toBeVisible();

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("health endpoints distinguish liveness from readiness", async ({ request }) => {
  const livenessResponse = await request.get("/api/health/live");
  expect(livenessResponse.ok()).toBe(true);
  await expect(livenessResponse.json()).resolves.toMatchObject({
    ok: true,
    data: { service: "seddleup", status: "live" }
  });

  const readinessResponse = await request.get("/api/health");
  expect(readinessResponse.ok()).toBe(true);
  await expect(readinessResponse.json()).resolves.toMatchObject({
    ok: true,
    data: {
      service: "seddleup",
      status: "ready",
      checks: {
        configuration: "ready",
        database: "ready",
        migrations: "ready"
      }
    }
  });
});
