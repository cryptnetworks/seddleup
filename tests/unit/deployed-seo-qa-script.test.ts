import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("deployed SEO QA launcher", () => {
  const source = readFileSync("scripts/run-deployed-seo-qa.mjs", "utf8");

  it("requires HTTPS and reuses the configured origin for navigation and assertions", () => {
    expect(source).toContain('origin.protocol !== "https:"');
    expect(source).toContain("PLAYWRIGHT_BASE_URL: origin.toString()");
    expect(source).toContain("PLAYWRIGHT_PUBLIC_APP_URL: origin.toString()");
    expect(source).not.toContain("DATABASE_URL");
  });
});
