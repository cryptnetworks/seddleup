import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const transactionUserUpdate = vi.fn();
  const transactionClient = { user: { update: transactionUserUpdate } };
  return {
    checkRateLimit: vi.fn(async () => ({ allowed: true })),
    findUnique: vi.fn(),
    redirect: vi.fn((url: string) => {
      throw new Error(`redirect:${url}`);
    }),
    revalidatePath: vi.fn(),
    requireAdminAction: vi.fn(),
    revokeUserSessionsInTransaction: vi.fn(),
    transaction: vi.fn(async (callback: (tx: typeof transactionClient) => unknown) =>
      callback(transactionClient)
    ),
    transactionClient,
    transactionUserUpdate,
    writeAuditLog: vi.fn()
  };
});

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/authorization", () => ({
  countActiveAdmins: vi.fn(),
  requireAdminAction: mocks.requireAdminAction
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: mocks.checkRateLimit }));
vi.mock("@/lib/audit", () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock("@/lib/session-revocation", () => ({
  revokeUserSessionsInTransaction: mocks.revokeUserSessionsInTransaction
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    user: {
      findUnique: mocks.findUnique,
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    authProviderConfig: { count: vi.fn(), upsert: vi.fn() }
  }
}));

function resetForm(confirmation = "target-user") {
  const formData = new FormData();
  formData.set("userId", "target-id");
  formData.set("confirmation", confirmation);
  return formData;
}

describe("admin MFA reset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminAction.mockResolvedValue({ id: "admin-id", role: "admin" });
    mocks.checkRateLimit.mockResolvedValue({ allowed: true });
    mocks.findUnique.mockResolvedValue({
      id: "target-id",
      username: "target-user",
      twoFactorMethod: "authenticator",
      authenticatorEnabled: true
    });
  });

  it("requires server-side admin authorization before reading the target", async () => {
    mocks.requireAdminAction.mockRejectedValueOnce(new Error("forbidden"));
    const { resetUserMfa } = await import("@/lib/actions/admin");

    await expect(resetUserMfa(resetForm())).rejects.toThrow("forbidden");
    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("requires the exact target username as explicit confirmation", async () => {
    const { resetUserMfa } = await import("@/lib/actions/admin");

    await expect(resetUserMfa(resetForm("different-user"))).rejects.toThrow(
      "redirect:/admin/users?mfa=confirmation"
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rate-limits repeated resets per administrator and target", async () => {
    mocks.checkRateLimit.mockResolvedValueOnce({ allowed: false });
    const { resetUserMfa } = await import("@/lib/actions/admin");

    await expect(resetUserMfa(resetForm())).rejects.toThrow("redirect:/admin/users?mfa=rate-limit");
    expect(mocks.checkRateLimit).toHaveBeenCalledWith("admin-mfa-reset:admin-id:target-id", {
      limit: 5,
      windowMs: 60 * 60 * 1000
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("clears MFA, revokes sessions, and writes a secret-free audit event atomically", async () => {
    const { resetUserMfa } = await import("@/lib/actions/admin");

    await expect(resetUserMfa(resetForm())).rejects.toThrow("redirect:/admin/users?mfa=reset");
    expect(mocks.transactionUserUpdate).toHaveBeenCalledWith({
      where: { id: "target-id" },
      data: {
        twoFactorMethod: "none",
        authenticatorEnabled: false,
        authenticatorSecretEncrypted: null
      }
    });
    expect(mocks.revokeUserSessionsInTransaction).toHaveBeenCalledWith(
      mocks.transactionClient,
      "target-id"
    );
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      {
        actorUserId: "admin-id",
        action: "user.mfa_reset_by_admin",
        targetType: "user",
        targetId: "target-id",
        metadata: { previousMethod: "authenticator" }
      },
      mocks.transactionClient
    );
    expect(JSON.stringify(mocks.writeAuditLog.mock.calls)).not.toMatch(/secret|otpauth|totp/i);
  });
});
