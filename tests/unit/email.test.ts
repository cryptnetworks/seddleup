import { afterEach, describe, expect, it } from "vitest";
import {
  buildInvitationEmail,
  buildEmailVerificationEmail,
  buildPasswordResetEmail,
  buildTwoFactorEmail
} from "@/lib/email";

const staleBrandPattern = /TripTally|triptally|trip-tally|Trip Tally|TRIPTALLY/;

function expectSeddleUpBranding(message: { subject: string; text: string; html: string }) {
  expect(message.subject).toContain("SeddleUp");
  expect(message.subject).not.toMatch(staleBrandPattern);
  expect(message.text).toContain("SeddleUp");
  expect(message.text).not.toMatch(staleBrandPattern);
  expect(message.html).toContain("SeddleUp");
  expect(message.html).toContain("Travel together. Settle up easily.");
  expect(message.html).toContain("#2563EB");
  expect(message.html).toContain("#0F172A");
  expect(message.html).toContain("#F8FAFC");
  expect(message.html).toContain("#111827");
  expect(message.html).toContain("#E2E8F0");
  expect(message.html).not.toMatch(staleBrandPattern);
}

describe("SeddleUp emails", () => {
  afterEach(() => {
    delete process.env.EMAIL_APP_NAME;
    delete process.env.APP_BASE_URL;
    delete process.env.PUBLIC_APP_URL;
    delete process.env.NEXTAUTH_URL;
  });

  it("builds a SeddleUp password reset email with plain text and branded HTML", () => {
    process.env.APP_BASE_URL = "https://app.seddleup.com";

    const message = buildPasswordResetEmail({
      to: "person@example.com",
      resetUrl: "https://app.seddleup.com/reset-password?token=abc",
      expiresInMinutes: 45
    });

    expect(message.subject).toBe("Reset your SeddleUp password");
    expect(message.text).toContain("https://app.seddleup.com/reset-password?token=abc");
    expect(message.html).toContain('src="https://app.seddleup.com/logo.png"');
    expect(message.html).toContain('alt="SeddleUp"');
    expect(message.html).toContain(">Reset password</a>");
    expectSeddleUpBranding(message);
  });

  it("builds a SeddleUp verification email", () => {
    const message = buildEmailVerificationEmail({
      to: "person@example.com",
      verifyUrl: "https://app.seddleup.com/verify-email?token=abc",
      expiresInHours: 24
    });

    expect(message.subject).toBe("Verify your SeddleUp account");
    expect(message.text).toContain("verify your email address");
    expect(message.text).toContain("https://app.seddleup.com/verify-email?token=abc");
    expectSeddleUpBranding(message);
  });

  it("builds a SeddleUp two-factor email with fallback text", () => {
    const message = buildTwoFactorEmail({
      to: "person@example.com",
      code: "123456",
      expiresInMinutes: 10
    });

    expect(message.subject).toBe("SeddleUp sign-in code");
    expect(message.text).toContain("Your SeddleUp sign-in code is 123456.");
    expect(message.html).toContain("123456");
    expectSeddleUpBranding(message);
  });

  it("builds a SeddleUp invitation email with inviter and trip context", () => {
    process.env.APP_BASE_URL = "https://app.seddleup.com";

    const message = buildInvitationEmail({
      to: "person@example.com",
      inviteUrl: "https://app.seddleup.com/invite/accept?token=abc",
      expiresInDays: 7,
      inviterName: "Admin User",
      inviterEmail: "admin@seddleup.com",
      tripName: "Cape Weekend"
    });

    expect(message.subject).toBe("You're invited to SeddleUp");
    expect(message.text).toContain("Admin User invited you to join SeddleUp for Cape Weekend.");
    expect(message.text).toContain("https://app.seddleup.com/invite/accept?token=abc");
    expect(message.html).toContain(">Accept invitation</a>");
    expect(message.html).toContain('alt="SeddleUp"');
    expectSeddleUpBranding(message);
  });

  it("uses a text wordmark fallback when no public base URL is configured", () => {
    const message = buildPasswordResetEmail({
      to: "person@example.com",
      resetUrl: "https://app.seddleup.com/reset-password?token=abc",
      expiresInMinutes: 45
    });

    expect(message.html).not.toContain("<img");
    expect(message.html).toContain("<strong");
    expect(message.html).toContain("SeddleUp");
  });
});
