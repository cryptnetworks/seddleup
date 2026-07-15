import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolvePlaywrightEnvironment } from "@/tests/e2e/environment";

describe("Playwright environment isolation", () => {
  it("does not inherit a Docker SQLite path when Playwright owns the local server", () => {
    const resolved = resolvePlaywrightEnvironment({
      DATABASE_URL: "file:/app/data/seddleup.db",
      PUBLIC_APP_URL: "https://seddleup.example"
    });

    expect(resolved).toMatchObject({
      ownsServer: true,
      serverPort: 3000,
      baseURL: "http://127.0.0.1:3000",
      publicAppUrl: "http://127.0.0.1:3000"
    });
    expect(resolved.databaseUrl).toBe(`file:${path.resolve("prisma/playwright.db")}`);
  });

  it("honors explicit isolated paths and an external production server", () => {
    const resolved = resolvePlaywrightEnvironment({
      PLAYWRIGHT_BASE_URL: "http://127.0.0.1:43123",
      PLAYWRIGHT_DATABASE_URL: "file:/tmp/seddleup-e2e/app.db",
      PLAYWRIGHT_PUBLIC_APP_URL: "https://qa.seddleup.invalid",
      PLAYWRIGHT_RECEIPT_UPLOAD_DIR: "/tmp/seddleup-e2e/receipts"
    });

    expect(resolved).toEqual({
      ownsServer: false,
      serverPort: 3000,
      baseURL: "http://127.0.0.1:43123",
      databaseUrl: "file:/tmp/seddleup-e2e/app.db",
      publicAppUrl: "https://qa.seddleup.invalid",
      receiptUploadDir: "/tmp/seddleup-e2e/receipts"
    });
  });
});
