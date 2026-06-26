import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertSameOriginRequest: vi.fn(),
  createAuthenticatorSetup: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
  requireUser: vi.fn()
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect
}));

vi.mock("@/lib/csrf", () => ({
  assertSameOriginRequest: mocks.assertSameOriginRequest
}));

vi.mock("@/lib/session", () => ({
  requireUser: mocks.requireUser
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUniqueOrThrow: mocks.findUniqueOrThrow
    }
  }
}));

vi.mock("@/lib/two-factor", () => ({
  createAuthenticatorSetup: mocks.createAuthenticatorSetup,
  enableAuthenticator: vi.fn(),
  twoFactorMethods: ["none", "email", "authenticator"]
}));

describe("authenticator setup server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertSameOriginRequest.mockResolvedValue(undefined);
    mocks.requireUser.mockResolvedValue({ id: "user-1" });
    mocks.findUniqueOrThrow.mockResolvedValue({
      id: "user-1",
      email: "mfa-user@seddleup.test"
    });
    mocks.createAuthenticatorSetup.mockResolvedValue({
      secret: "JBSWY3DPEHPK3PXP",
      uri: "otpauth://totp/SeddleUp%3Amfa-user%40seddleup.test?secret=JBSWY3DPEHPK3PXP"
    });
  });

  it("redirects after creating setup without exposing the raw secret or otpauth URI", async () => {
    const { startAuthenticatorSetup } = await import("@/lib/actions/auth");

    await expect(startAuthenticatorSetup()).rejects.toThrow(
      "redirect:/account?twoFactor=authenticator-setup"
    );

    expect(mocks.createAuthenticatorSetup).toHaveBeenCalledWith({
      id: "user-1",
      email: "mfa-user@seddleup.test"
    });

    const redirectUrl = mocks.redirect.mock.calls.at(-1)?.[0] ?? "";
    const parsedUrl = new URL(redirectUrl, "http://localhost");

    expect(parsedUrl.pathname).toBe("/account");
    expect(parsedUrl.searchParams.get("twoFactor")).toBe("authenticator-setup");
    expect(parsedUrl.searchParams.has("authenticatorSecret")).toBe(false);
    expect(parsedUrl.searchParams.has("authenticatorUri")).toBe(false);
    expect(redirectUrl).not.toContain("JBSWY3DPEHPK3PXP");
    expect(redirectUrl).not.toContain("otpauth");
    expect(decodeURIComponent(redirectUrl)).not.toContain("secret=");
  });
});
