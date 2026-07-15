import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { DatabaseSync } from "node:sqlite";
import {
  addExpense,
  addParticipant,
  configureTestAuthSettings,
  registerAndLogin,
  sqliteDatabasePath
} from "./helpers";

const tripViewports = [
  { width: 320, height: 568 },
  { width: 360, height: 800 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 430, height: 932 },
  // A 1280px desktop viewport reflows to this CSS width at 200% zoom.
  { width: 640, height: 900 },
  { width: 768, height: 1024 },
  { width: 1280, height: 900 }
];

const publicViewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 640, height: 900 },
  { width: 768, height: 1024 },
  { width: 1280, height: 900 }
];

test.beforeAll(() => {
  configureTestAuthSettings();
});

function supportsMobileLayoutProject(testInfo: TestInfo) {
  return ["Chromium", "Mobile Safari"].includes(testInfo.project.name);
}

async function horizontalOverflowReport(page: Page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const viewportWidth = root.clientWidth;
    const offenders = Array.from(document.body.querySelectorAll<HTMLElement>("*"))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const intentionallyScrollable = ["auto", "scroll"].includes(style.overflowX);
        return !intentionallyScrollable && (rect.left < -1 || rect.right > viewportWidth + 1);
      })
      .reverse()
      .slice(0, 12)
      .map((element) => ({
        element: element.tagName.toLowerCase(),
        className: element.className,
        testId: element.dataset.testid,
        text: element.textContent?.slice(0, 120),
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        rect: element.getBoundingClientRect().toJSON()
      }));

    return {
      clientWidth: viewportWidth,
      scrollWidth: root.scrollWidth,
      offenders
    };
  });
}

async function expectNoHorizontalPageOverflow(page: Page, context: string) {
  const report = await horizontalOverflowReport(page);
  expect(
    report.scrollWidth,
    `${context}: page overflowed ${report.clientWidth}px viewport; ${JSON.stringify(report.offenders)}`
  ).toBeLessThanOrEqual(report.clientWidth + 1);
}

async function expectInsidePageWidth(page: Page, selector: string) {
  const result = await page
    .locator(selector)
    .first()
    .evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        viewportWidth: document.documentElement.clientWidth
      };
    });

  expect(result.left).toBeGreaterThanOrEqual(-1);
  expect(result.right).toBeLessThanOrEqual(result.viewportWidth + 1);
}

function grantAdminRole(email: string) {
  const database = new DatabaseSync(sqliteDatabasePath(), { timeout: 5000 });
  try {
    database.prepare("UPDATE users SET role = ? WHERE email = ?").run("admin", email);
  } finally {
    database.close();
  }
}

test("public and authentication pages fit narrow and tablet viewports", async ({
  page
}, testInfo) => {
  test.skip(
    !supportsMobileLayoutProject(testInfo),
    "Mobile layout coverage runs in Chromium and Mobile Safari."
  );

  for (const viewport of publicViewports) {
    await page.setViewportSize(viewport);
    for (const path of [
      "/",
      "/login",
      "/register",
      "/forgot-password",
      "/reset-password",
      "/verify-email",
      "/offline",
      "/invite/accept",
      "/share/trip/not-a-valid-token"
    ]) {
      await page.goto(path);
      await expectNoHorizontalPageOverflow(page, `${path} at ${viewport.width}px`);
      await expectInsidePageWidth(page, "main");
    }
  }
});

test("default trip detail remains usable with long realistic content", async ({
  page
}, testInfo) => {
  test.skip(
    !supportsMobileLayoutProject(testInfo),
    "Mobile layout coverage runs in Chromium and Mobile Safari."
  );

  const user = await registerAndLogin(page, testInfo, "mobile-layout");
  await page.goto("/trips/new");
  const tripName =
    "A very long international friends and family summer adventure with several destinations";
  await page.getByLabel("Trip name").fill(tripName);
  await page
    .getByLabel("Destination")
    .fill("San Francisco, Yosemite National Park, and the Northern California coastline");
  await page.getByLabel("Start date").fill("2026-07-01");
  await page.getByLabel("End date").fill("2026-07-14");
  await page.getByRole("button", { name: "Save trip" }).click();

  const longParticipant = "Alexandria-Cassandra Montgomery-Worthington the Third";
  await addParticipant(
    page,
    longParticipant,
    "alexandria.cassandra.montgomery.worthington@example-travel-group.test"
  );
  await addParticipant(page, "Bob", "bob.mobile-layout@example.com");
  await addExpense(
    page,
    "A very long shared dinner description with transportation and celebration costs",
    "999999.99"
  );
  const tripUrl = page.url().replace(/\?.*$/, "");
  const participantEditHref = await page
    .getByTestId("participant-card")
    .filter({ hasText: longParticipant })
    .getByTestId("participant-edit")
    .getAttribute("href");
  expect(participantEditHref).toBeTruthy();

  for (const viewport of tripViewports) {
    await page.setViewportSize(viewport);
    await page.goto(tripUrl);
    await expect(page).toHaveURL(tripUrl);
    await expect(page.getByRole("heading", { name: tripName })).toBeVisible();
    await expectNoHorizontalPageOverflow(page, `trip detail at ${viewport.width}px`);

    for (const testId of ["add-expense", "edit-trip", "share-trip", "delete-trip"]) {
      await expect(page.getByTestId(testId)).toBeVisible();
      await expectInsidePageWidth(page, `[data-testid="${testId}"]`);
    }

    const participant = page.getByTestId("participant-card").filter({ hasText: longParticipant });
    await expect(participant).toBeVisible();
    await expectInsidePageWidth(page, `[data-testid="participant-card"]`);
    await expect(participant.getByTestId("participant-edit")).toBeVisible();
    await expect(
      participant.getByRole("button", { name: `Delete ${longParticipant}` })
    ).toBeVisible();

    const filters = page.locator('a[href*="?filter="]').first().locator("..");
    await expect(filters).toBeVisible();
    const filterBox = await filters.boundingBox();
    expect(filterBox).not.toBeNull();
    expect(filterBox!.x).toBeGreaterThanOrEqual(-1);
    expect(filterBox!.x + filterBox!.width).toBeLessThanOrEqual(viewport.width + 1);
    if (viewport.width === 320) {
      expect(await filters.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
        true
      );
    }

    await expect(page.getByTestId("expense-card")).toContainText("999,999.99");
    await expect(page.getByTestId("balance-card").first()).toBeVisible();

    if (viewport.width < 768) {
      await expect(page.getByTestId("mobile-nav-trips")).toHaveAttribute("aria-current", "page");
      const lastSection = page.getByTestId("trip-activity");
      const lastActivity = lastSection.getByTestId("trip-activity-item").last();
      await lastActivity.scrollIntoViewIfNeeded();
      const navBox = await page.getByTestId("mobile-bottom-nav").boundingBox();
      const lastBox = await lastActivity.boundingBox();
      expect(navBox).not.toBeNull();
      expect(lastBox).not.toBeNull();
      expect(lastBox!.y + lastBox!.height).toBeLessThanOrEqual(navBox!.y + 1);
    } else {
      await expect(page.getByTestId("mobile-bottom-nav")).toBeHidden();
    }

    await page.goto(`${tripUrl}/expenses/new`);
    await expectNoHorizontalPageOverflow(page, `expense form at ${viewport.width}px`);
    await expectInsidePageWidth(page, `[data-testid="expense-form"]`);
  }

  const authenticatedRoutes = [
    "/dashboard",
    "/trips",
    "/trips/new",
    `${tripUrl}/edit`,
    `${tripUrl}/share`,
    `${tripUrl}/expenses/new`,
    participantEditHref!,
    `${tripUrl}/receipts/new`,
    "/account"
  ];

  for (const viewport of [
    { width: 320, height: 568 },
    { width: 768, height: 1024 }
  ]) {
    await page.setViewportSize(viewport);
    for (const path of authenticatedRoutes) {
      await page.goto(path);
      await expectNoHorizontalPageOverflow(page, `${path} at ${viewport.width}px`);
      await expectInsidePageWidth(page, "main");
    }
  }

  grantAdminRole(user.email);
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 768, height: 1024 }
  ]) {
    await page.setViewportSize(viewport);
    for (const path of [
      "/admin",
      "/admin/users",
      "/admin/auth",
      "/admin/audit",
      "/admin/settings"
    ]) {
      await page.goto(path);
      await expectNoHorizontalPageOverflow(page, `${path} at ${viewport.width}px`);
      await expectInsidePageWidth(page, "main");
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => localStorage.setItem("theme", "dark"));
  await page.goto(tripUrl);
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expectNoHorizontalPageOverflow(page, "trip detail in dark mode at 390px");
});
