import { expect, test } from "@playwright/test";

test.skip(process.env.PLAYWRIGHT_SERVER_MODE !== "production", "Production server coverage only.");

test("production WebKit loads public, auth, protected, and health routes without chunk errors", async ({
  page,
  request
}) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Login" })).toBeVisible();
  await page.goto("/register");
  await expect(page.getByRole("heading", { name: "Register" })).toBeVisible();
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);

  const readiness = await request.get("/api/health");
  expect(readiness.ok()).toBe(true);
  const chunkErrors = browserErrors.filter((message) =>
    /ChunkLoadError|Loading chunk|Failed to load chunk/i.test(message)
  );
  expect(chunkErrors).toEqual([]);
});
