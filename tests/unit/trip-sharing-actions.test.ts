import { beforeEach, describe, expect, it, vi } from "vitest";

const RAW_TOKEN = "A".repeat(43);
const TOKEN_DIGEST = "b".repeat(64);
const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
  requireCurrentUserId: vi.fn(),
  requireTripManager: vi.fn(),
  writeAuditLog: vi.fn(),
  revalidatePath: vi.fn(),
  update: vi.fn()
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/actions/session", () => ({ requireCurrentUserId: mocks.requireCurrentUserId }));
vi.mock("@/lib/trip-access", () => ({ requireTripManager: mocks.requireTripManager }));
vi.mock("@/lib/audit", () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/url", () => ({
  publicUrl: (path: string) => new URL(path, "https://seddleup.test")
}));
vi.mock("@/lib/trip-sharing", () => ({
  DEFAULT_TRIP_SHARE_EXPIRY: "30",
  DEFAULT_TRIP_SHARE_NAME_MODE: "anonymized",
  tripShareExpiryOptions: ["7", "30", "90", "never"],
  tripShareNameModes: ["anonymized", "initials", "first_name", "full_name"],
  generateTripShareToken: () => RAW_TOKEN,
  hashTripShareToken: () => TOKEN_DIGEST,
  tripShareExpiresAt: () => new Date("2026-08-13T00:00:00Z"),
  tripShareStatus: () => "active"
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    tripShareLink: {
      findUnique: mocks.findUnique,
      upsert: mocks.upsert,
      update: mocks.update
    }
  }
}));

describe("trip sharing server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentUserId.mockResolvedValue("manager-1");
    mocks.findUnique.mockResolvedValue(null);
    mocks.upsert.mockResolvedValue({
      id: "share-link-1",
      tokenHash: TOKEN_DIGEST,
      participantNameMode: "anonymized",
      expiresAt: new Date("2026-08-13T00:00:00Z")
    });
  });

  it("requires manager access and persists only the token digest", async () => {
    const { createOrRotateTripShareLink } = await import("@/lib/actions/trip-sharing");
    const formData = new FormData();
    formData.set("participantNameMode", "anonymized");
    formData.set("expiry", "30");

    const result = await createOrRotateTripShareLink(
      "cm12345678901234567890123",
      { status: "idle" },
      formData
    );

    expect(mocks.requireTripManager).toHaveBeenCalledWith("cm12345678901234567890123", "manager-1");
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ tokenHash: TOKEN_DIGEST })
      })
    );
    expect(JSON.stringify(mocks.upsert.mock.calls)).not.toContain(RAW_TOKEN);
    expect(result.shareUrl).toBe(`https://seddleup.test/share/trip/${RAW_TOKEN}`);
    expect(JSON.stringify(mocks.writeAuditLog.mock.calls)).not.toContain(RAW_TOKEN);
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "trip_share.create", tripId: "cm12345678901234567890123" })
    );
  });

  it("does not persist or audit when trip-manager authorization fails", async () => {
    mocks.requireTripManager.mockRejectedValueOnce(new Error("forbidden"));
    const { createOrRotateTripShareLink } = await import("@/lib/actions/trip-sharing");
    const formData = new FormData();
    formData.set("participantNameMode", "full_name");
    formData.set("expiry", "never");

    await expect(
      createOrRotateTripShareLink("cm12345678901234567890123", { status: "idle" }, formData)
    ).rejects.toThrow("forbidden");
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("audits rotation and revocation without recording the raw token", async () => {
    const existing = {
      id: "share-link-1",
      tokenHash: "c".repeat(64),
      participantNameMode: "initials",
      expiresAt: null,
      revokedAt: null
    };
    mocks.findUnique.mockResolvedValue(existing);
    mocks.update.mockResolvedValue({ ...existing, revokedAt: new Date() });
    const { createOrRotateTripShareLink, revokeTripShareLink } =
      await import("@/lib/actions/trip-sharing");
    const formData = new FormData();
    formData.set("participantNameMode", "anonymized");
    formData.set("expiry", "30");

    await createOrRotateTripShareLink("cm12345678901234567890123", { status: "idle" }, formData);
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "trip_share.rotate" })
    );

    mocks.writeAuditLog.mockClear();
    await revokeTripShareLink("cm12345678901234567890123", { status: "idle" });
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "trip_share.revoke" })
    );
    expect(JSON.stringify(mocks.writeAuditLog.mock.calls)).not.toContain(RAW_TOKEN);
  });
});
