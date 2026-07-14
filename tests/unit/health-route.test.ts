import { beforeEach, describe, expect, it, vi } from "vitest";

const { checkReadiness, warn } = vi.hoisted(() => ({
  checkReadiness: vi.fn(),
  warn: vi.fn()
}));

vi.mock("@/lib/readiness", () => ({ checkReadiness }));
vi.mock("@/lib/logger", () => ({
  logger: { warn }
}));

import { GET as getReadiness } from "@/app/api/health/route";
import { GET as getLiveness } from "@/app/api/health/live/route";

describe("health routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a dependency-free, non-cacheable liveness response", async () => {
    const response = getLiveness();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: { service: "seddleup", status: "live" }
    });
    expect(checkReadiness).not.toHaveBeenCalled();
  });

  it("returns safe readiness states without logging exception details", async () => {
    checkReadiness.mockResolvedValue({
      status: "not_ready",
      failedCheck: "database",
      checks: {
        configuration: "ready",
        database: "unavailable",
        migrations: "not_checked"
      }
    });

    const response = await getReadiness();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toMatchObject({
      ok: false,
      data: {
        service: "seddleup",
        status: "not_ready",
        checks: {
          configuration: "ready",
          database: "unavailable",
          migrations: "not_checked"
        }
      },
      error: { message: "Service is not ready" }
    });
    expect(JSON.stringify(body)).not.toMatch(/file:|token|secret|migration_name/i);
    expect(warn).toHaveBeenCalledWith("readiness.failed", { check: "database" });
  });
});
