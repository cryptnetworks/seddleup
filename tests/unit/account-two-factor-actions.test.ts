import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertSameOriginRequest: vi.fn(),
  emailDeliveryAvailable: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
  requireUser: vi.fn(),
  update: vi.fn()
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect
}));

vi.mock("@/lib/csrf", () => ({
  assertSameOriginRequest: mocks.assertSameOriginRequest
}));

vi.mock("@/lib/email", () => ({
  emailDeliveryAvailable: mocks.emailDeliveryAvailable,
  sendEmailVerificationEmail: vi.fn(),
  sendInvitationEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  sendTwoFactorEmail: vi.fn()
}));

vi.mock("@/lib/session", () => ({
  requireUser: mocks.requireUser
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUniqueOrThrow: mocks.findUniqueOrThrow,
      update: mocks.update
    }
  }
}));

vi.mock("@/lib/two-factor", () => ({
  createAuthenticatorSetup: vi.fn(),
  enableAuthenticator: vi.fn(),
  twoFactorMethods: ["none", "email", "authenticator"]
}));

function twoFactorForm(method: string) {
  const formData = new FormData();
  formData.set("method", method);
  return formData;
}

describe("account two-factor method actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertSameOriginRequest.mockResolvedValue(undefined);
    mocks.emailDeliveryAvailable.mockReturnValue(true);
    mocks.requireUser.mockResolvedValue({ id: "user-1" });
    mocks.findUniqueOrThrow.mockResolvedValue({
      authenticatorEnabled: false,
      twoFactorMethod: "none"
    });
    mocks.update.mockResolvedValue({});
  });

  it("blocks newly enabling email MFA when SMTP delivery is unavailable", async () => {
    mocks.emailDeliveryAvailable.mockReturnValue(false);
    const { setTwoFactorMethod } = await import("@/lib/actions/auth");

    await expect(setTwoFactorMethod(twoFactorForm("email"))).rejects.toThrow(
      "redirect:/account?twoFactor=email-unavailable"
    );

    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("allows keeping email MFA selected when it was already enabled", async () => {
    mocks.emailDeliveryAvailable.mockReturnValue(false);
    mocks.findUniqueOrThrow.mockResolvedValue({
      authenticatorEnabled: false,
      twoFactorMethod: "email"
    });
    const { setTwoFactorMethod } = await import("@/lib/actions/auth");

    await expect(setTwoFactorMethod(twoFactorForm("email"))).rejects.toThrow(
      "redirect:/account?twoFactor=updated"
    );

    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { twoFactorMethod: "email" }
    });
  });

  it("allows disabling email MFA when SMTP delivery is unavailable", async () => {
    mocks.emailDeliveryAvailable.mockReturnValue(false);
    mocks.findUniqueOrThrow.mockResolvedValue({
      authenticatorEnabled: false,
      twoFactorMethod: "email"
    });
    const { setTwoFactorMethod } = await import("@/lib/actions/auth");

    await expect(setTwoFactorMethod(twoFactorForm("none"))).rejects.toThrow(
      "redirect:/account?twoFactor=updated"
    );

    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { twoFactorMethod: "none" }
    });
  });

  it("allows enabling email MFA when SMTP delivery is configured", async () => {
    const { setTwoFactorMethod } = await import("@/lib/actions/auth");

    await expect(setTwoFactorMethod(twoFactorForm("email"))).rejects.toThrow(
      "redirect:/account?twoFactor=updated"
    );

    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { twoFactorMethod: "email" }
    });
  });

  it("does not require SMTP delivery for authenticator MFA", async () => {
    mocks.emailDeliveryAvailable.mockReturnValue(false);
    mocks.findUniqueOrThrow.mockResolvedValue({
      authenticatorEnabled: true,
      twoFactorMethod: "none"
    });
    const { setTwoFactorMethod } = await import("@/lib/actions/auth");

    await expect(setTwoFactorMethod(twoFactorForm("authenticator"))).rejects.toThrow(
      "redirect:/account?twoFactor=updated"
    );

    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { twoFactorMethod: "authenticator" }
    });
  });
});
