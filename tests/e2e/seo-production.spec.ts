import { expect, test } from "@playwright/test";

test.skip(process.env.PLAYWRIGHT_SERVER_MODE !== "production", "Production SEO coverage only.");

const publicOrigin = process.env.PLAYWRIGHT_PUBLIC_APP_URL ?? "https://qa.seddleup.invalid";
const publicViewports = [320, 360, 375, 390, 430, 768, 1280];

test("production homepage metadata, structured data, semantics, headers, and layouts are sound", async ({
  page,
  request
}) => {
  const homepageResponse = await page.goto("/");
  expect(homepageResponse?.ok()).toBe(true);
  expect(homepageResponse?.headers()["x-content-type-options"]).toBe("nosniff");
  expect(homepageResponse?.headers()["x-frame-options"]).toBe("DENY");
  expect(homepageResponse?.headers()["referrer-policy"]).toBeTruthy();

  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", publicOrigin);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", publicOrigin);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    `${publicOrigin}/branding/og-image.png`
  );
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    "content",
    "summary_large_image"
  );
  await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute("content", /SeddleUp/);
  await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute(
    "content",
    `${publicOrigin}/branding/og-image.png`
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);

  const structuredData = await page.locator('script[type="application/ld+json"]').textContent();
  expect(structuredData).toBeTruthy();
  const graph = JSON.parse(structuredData ?? "{}")["@graph"] as Array<Record<string, unknown>>;
  expect(graph.map((entry) => entry["@type"])).toEqual([
    "WebSite",
    "SoftwareApplication",
    "FAQPage"
  ]);

  const headingLevels = await page
    .locator("h1, h2, h3, h4, h5, h6")
    .evaluateAll((headings) => headings.map((heading) => Number(heading.tagName.slice(1))));
  for (let index = 1; index < headingLevels.length; index += 1) {
    expect(headingLevels[index] - headingLevels[index - 1]).toBeLessThanOrEqual(1);
  }

  for (const width of publicViewports) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasHorizontalOverflow, `homepage overflow at ${width}px`).toBe(false);
  }

  const robotsResponse = await request.get("/robots.txt");
  expect(robotsResponse.ok()).toBe(true);
  const robots = await robotsResponse.text();
  expect(robots).toContain(`Sitemap: ${publicOrigin}/sitemap.xml`);
  expect(robots).toContain("Disallow: /dashboard");

  const sitemapResponse = await request.get("/sitemap.xml");
  expect(sitemapResponse.ok()).toBe(true);
  expect(await sitemapResponse.text()).toContain(`<loc>${publicOrigin}/</loc>`);

  const manifestResponse = await request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBe(true);
  await expect(manifestResponse.json()).resolves.toMatchObject({
    name: "SeddleUp",
    short_name: "SeddleUp",
    start_url: "/"
  });

  const loginResponse = await page.goto("/login");
  expect(loginResponse?.headers()["x-robots-tag"]).toContain("noindex");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});
