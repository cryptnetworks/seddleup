import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAndSendInvitation: vi.fn(),
  createAndSendTripInvitation: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
  requireAdminAction: vi.fn(),
  requireCurrentUserId: vi.fn(),
  requireTripManager: vi.fn(),
  writeAuditLog: vi.fn(),
  revalidatePath: vi.fn(),
  checkRateLimit: vi.fn(() => ({ allowed: true })),
  participantCreate: vi.fn()
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath
}));

vi.mock("@/lib/authorization", () => ({
  countActiveAdmins: vi.fn(),
  requireAdminAction: mocks.requireAdminAction
}));

vi.mock("@/lib/actions/session", () => ({
  requireCurrentUserId: mocks.requireCurrentUserId
}));

vi.mock("@/lib/trip-access", () => ({
  requireTripManager: mocks.requireTripManager
}));

vi.mock("@/lib/invitations", () => ({
  createAndSendInvitation: mocks.createAndSendInvitation,
  createAndSendTripInvitation: mocks.createAndSendTripInvitation,
  resendInvitation: vi.fn(),
  revokeInvitation: vi.fn()
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: mocks.writeAuditLog
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    participant: {
      create: mocks.participantCreate,
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    tripMember: {
      upsert: vi.fn()
    },
    user: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    authProviderConfig: {
      count: vi.fn(),
      upsert: vi.fn()
    }
  }
}));

describe("invitation server action protections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkRateLimit.mockReturnValue({ allowed: true });
  });

  it("does not create an admin invitation when admin authorization fails", async () => {
    mocks.requireAdminAction.mockImplementationOnce(() => {
      throw new Error("redirect:/dashboard?error=forbidden");
    });
    const { inviteUser } = await import("@/lib/actions/admin");
    const formData = new FormData();
    formData.set("email", "new-user@seddleup.test");
    formData.set("displayName", "New User");
    formData.set("role", "user");

    await expect(inviteUser(formData)).rejects.toThrow("redirect:/dashboard?error=forbidden");
    expect(mocks.createAndSendInvitation).not.toHaveBeenCalled();
  });

  it("does not create a trip invitation before trip-manager permission succeeds", async () => {
    mocks.requireCurrentUserId.mockResolvedValueOnce("user-1");
    mocks.requireTripManager.mockImplementationOnce(() => {
      throw new Error("redirect:/trips/trip-1?error=forbidden");
    });
    const { createParticipant } = await import("@/lib/actions/participants");
    const formData = new FormData();
    formData.set("name", "Pending Traveler");
    formData.set("email", "pending@seddleup.test");

    await expect(createParticipant("trip-1", formData)).rejects.toThrow(
      "redirect:/trips/trip-1?error=forbidden"
    );
    expect(mocks.participantCreate).not.toHaveBeenCalled();
    expect(mocks.createAndSendTripInvitation).not.toHaveBeenCalled();
  });
});
