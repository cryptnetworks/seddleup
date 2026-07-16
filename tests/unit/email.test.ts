import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildInvitationEmail,
  buildEmailVerificationEmail,
  buildPasswordResetEmail,
  buildTwoFactorEmail,
  EMAIL_BRAND,
  emailDeliveryAvailable
} from "@/lib/email";

const staleBrandPattern = /TripTally|triptally|trip-tally|Trip Tally|TRIPTALLY/;
const logoSvg = readFileSync("public/logo.svg", "utf8");

function expectSeddleUpBranding(message: { subject: string; text: string; html: string }) {
  expect(message.subject).toContain("SeddleUp");
  expect(message.subject).not.toMatch(staleBrandPattern);
  expect(message.text).toContain("SeddleUp");
  expect(message.text).not.toMatch(staleBrandPattern);
  expect(message.html).toContain("SeddleUp");
  expect(message.html).toContain("Travel together. Settle up easily.");
  for (const color of [
    EMAIL_BRAND.accent,
    EMAIL_BRAND.primary,
    EMAIL_BRAND.background,
    EMAIL_BRAND.text,
    EMAIL_BRAND.border
  ]) {
    expect(message.html).toContain(color);
  }
  expect(message.html).not.toMatch(staleBrandPattern);
}

function emailTemplateSignature(message: { subject: string; html: string }) {
  return {
    subject: message.subject,
    hasOuterBackground: message.html.includes(`background:${EMAIL_BRAND.background}`),
    hasCardBorder: message.html.includes(`border:1px solid ${EMAIL_BRAND.border}`),
    hasBrandHeader: message.html.includes(`background:${EMAIL_BRAND.brandSoft}`),
    hasTagline: message.html.includes(EMAIL_BRAND.tagline),
    headingCount: message.html.match(/<h1\b/g)?.length ?? 0,
    actionKind: message.html.includes("<a href=") ? "link" : "code",
    logoKind: message.html.includes("<img") ? "image" : "wordmark"
  };
}

describe("SeddleUp emails", () => {
  afterEach(() => {
    delete process.env.EMAIL_APP_NAME;
    delete process.env.APP_BASE_URL;
    delete process.env.PUBLIC_APP_URL;
    delete process.env.NEXTAUTH_URL;
    delete process.env.SMTP_ENABLED;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_FROM;
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

  it("uses the checked-in SeddleUp logo palette and tagline in email templates", () => {
    const message = buildPasswordResetEmail({
      to: "person@example.com",
      resetUrl: "https://app.seddleup.com/reset-password?token=abc",
      expiresInMinutes: 45
    });

    for (const color of [EMAIL_BRAND.accent, EMAIL_BRAND.primary, EMAIL_BRAND.muted]) {
      expect(logoSvg).toContain(color);
      expect(message.html).toContain(color);
    }
    expect(logoSvg).toContain("Travel together. Settle up easily.");
    expect(message.html).toContain("Travel together. Settle up easily.");
  });

  it("keeps stable structural signatures for every user-facing template", () => {
    process.env.APP_BASE_URL = "https://app.seddleup.test";
    const signatures = [
      buildPasswordResetEmail({
        to: "person@example.com",
        resetUrl: "https://app.seddleup.test/reset-password?token=fixture",
        expiresInMinutes: 45
      }),
      buildEmailVerificationEmail({
        to: "person@example.com",
        verifyUrl: "https://app.seddleup.test/verify-email?token=fixture",
        expiresInHours: 24
      }),
      buildTwoFactorEmail({ to: "person@example.com", code: "123456", expiresInMinutes: 10 }),
      buildInvitationEmail({
        to: "person@example.com",
        inviteUrl: "https://app.seddleup.test/invite/accept?token=fixture",
        expiresInDays: 7
      })
    ].map(emailTemplateSignature);

    expect(signatures).toMatchInlineSnapshot(`
      [
        {
          "actionKind": "link",
          "hasBrandHeader": true,
          "hasCardBorder": true,
          "hasOuterBackground": true,
          "hasTagline": true,
          "headingCount": 1,
          "logoKind": "image",
          "subject": "Reset your SeddleUp password",
        },
        {
          "actionKind": "link",
          "hasBrandHeader": true,
          "hasCardBorder": true,
          "hasOuterBackground": true,
          "hasTagline": true,
          "headingCount": 1,
          "logoKind": "image",
          "subject": "Verify your SeddleUp account",
        },
        {
          "actionKind": "code",
          "hasBrandHeader": true,
          "hasCardBorder": true,
          "hasOuterBackground": true,
          "hasTagline": true,
          "headingCount": 1,
          "logoKind": "image",
          "subject": "SeddleUp sign-in code",
        },
        {
          "actionKind": "link",
          "hasBrandHeader": true,
          "hasCardBorder": true,
          "hasOuterBackground": true,
          "hasTagline": true,
          "headingCount": 1,
          "logoKind": "image",
          "subject": "You're invited to SeddleUp",
        },
      ]
    `);
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

  it("falls back to SeddleUp when a stale legacy email app name is configured", () => {
    process.env.EMAIL_APP_NAME = "TripTally";

    const message = buildTwoFactorEmail({
      to: "person@example.com",
      code: "123456",
      expiresInMinutes: 10
    });

    expect(message.subject).toBe("SeddleUp sign-in code");
    expect(message.text).toContain("Your SeddleUp sign-in code is 123456.");
    expectSeddleUpBranding(message);
  });

  it("reports email delivery unavailable when SMTP is disabled", () => {
    process.env.SMTP_ENABLED = "false";
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_FROM = "no-reply@seddleup.test";

    expect(emailDeliveryAvailable()).toBe(false);
  });

  it("reports email delivery unavailable when SMTP settings are incomplete", () => {
    process.env.SMTP_ENABLED = "true";
    process.env.SMTP_HOST = "smtp.example.com";

    expect(emailDeliveryAvailable()).toBe(false);
  });

  it("reports email delivery available when SMTP host and sender are configured", () => {
    process.env.SMTP_ENABLED = "true";
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_FROM = "no-reply@seddleup.test";

    expect(emailDeliveryAvailable()).toBe(true);
  });
});
