import { SMTPClient } from "emailjs";
import { logger } from "@/lib/logger";

type ResetEmailInput = {
  to: string;
  resetUrl: string;
  expiresInMinutes: number;
};

type VerificationEmailInput = {
  to: string;
  verifyUrl: string;
  expiresInHours: number;
};

type TwoFactorEmailInput = {
  to: string;
  code: string;
  expiresInMinutes: number;
};

export type InvitationEmailInput = {
  to: string;
  inviteUrl: string;
  expiresInDays: number;
  inviterName?: string | null;
  inviterEmail?: string | null;
  tripName?: string | null;
};

type EmailMessage = {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
};

const BRAND = {
  appName: "SeddleUp",
  tagline: "Travel together. Settle up easily.",
  primary: "#0F172A",
  secondary: "#1E293B",
  accent: "#2563EB",
  success: "#10B981",
  background: "#F8FAFC",
  text: "#111827",
  muted: "#64748B",
  border: "#E2E8F0",
  brandSoft: "#DBEAFE"
} as const;

const legacyAppNamePattern = /^(triptally|trip tally|trip-tally)$/i;

function smtpConfigured() {
  if (process.env.SMTP_ENABLED === "false") {
    return false;
  }
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

function smtpPort() {
  const parsed = Number(process.env.SMTP_PORT || "587");
  return Number.isFinite(parsed) ? parsed : 587;
}

function baseTransportOptions() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const secure = process.env.SMTP_SECURE === "true";
  return {
    host: process.env.SMTP_HOST,
    port: smtpPort(),
    ssl: secure,
    tls: !secure,
    user,
    password: pass
  };
}

async function sendSmtpEmail(message: EmailMessage) {
  const client = new SMTPClient(baseTransportOptions());

  try {
    await client.sendAsync({
      from: message.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      attachment: [
        {
          data: message.html,
          alternative: true,
          type: "text/html"
        }
      ]
    });
  } finally {
    client.smtp.close();
  }
}

export async function sendPasswordResetEmail({ to, resetUrl, expiresInMinutes }: ResetEmailInput) {
  if (!smtpConfigured()) {
    logger.info("email.password_reset.disabled");
    if (process.env.NODE_ENV !== "production") {
      logger.info("email.password_reset.dev_link", { resetUrl });
    }
    return;
  }

  const from = process.env.SMTP_FROM as string;
  const email = buildPasswordResetEmail({ to, resetUrl, expiresInMinutes });

  try {
    await sendSmtpEmail({
      from,
      to,
      ...email
    });
  } catch (error) {
    logger.error("email.password_reset.failed", {
      error: error instanceof Error ? error.message : "Unknown email error"
    });
    return;
  }

  logger.info("email.password_reset.sent", { to });
}

export async function sendEmailVerificationEmail({
  to,
  verifyUrl,
  expiresInHours
}: VerificationEmailInput) {
  if (!smtpConfigured()) {
    logger.info("email.verification.disabled");
    if (process.env.NODE_ENV !== "production") {
      logger.info("email.verification.dev_link", { verifyUrl });
    }
    return;
  }

  const from = process.env.SMTP_FROM as string;
  const email = buildEmailVerificationEmail({ to, verifyUrl, expiresInHours });

  try {
    await sendSmtpEmail({
      from,
      to,
      ...email
    });
  } catch (error) {
    logger.error("email.verification.failed", {
      error: error instanceof Error ? error.message : "Unknown email error"
    });
    return;
  }

  logger.info("email.verification.sent", { to });
}

export async function sendTwoFactorEmail({ to, code, expiresInMinutes }: TwoFactorEmailInput) {
  if (!smtpConfigured()) {
    logger.warn("email.two_factor.disabled");
    if (process.env.NODE_ENV !== "production") {
      logger.info("email.two_factor.dev_code", { code });
    }
    return;
  }

  const from = process.env.SMTP_FROM as string;
  const email = buildTwoFactorEmail({ to, code, expiresInMinutes });

  try {
    await sendSmtpEmail({
      from,
      to,
      ...email
    });
  } catch (error) {
    logger.error("email.two_factor.failed", {
      error: error instanceof Error ? error.message : "Unknown email error"
    });
    return;
  }

  logger.info("email.two_factor.sent", { to });
}

export async function sendInvitationEmail(input: InvitationEmailInput) {
  if (!smtpConfigured()) {
    logger.info("email.invitation.disabled");
    if (process.env.NODE_ENV !== "production") {
      logger.info("email.invitation.dev_link", { inviteUrl: input.inviteUrl });
    }
    return;
  }

  const from = process.env.SMTP_FROM as string;
  const email = buildInvitationEmail(input);

  try {
    await sendSmtpEmail({
      from,
      to: input.to,
      ...email
    });
  } catch (error) {
    logger.error("email.invitation.failed", {
      error: error instanceof Error ? error.message : "Unknown email error"
    });
    return;
  }

  logger.info("email.invitation.sent", { to: input.to });
}

export function buildPasswordResetEmail(input: ResetEmailInput) {
  const appName = emailAppName();
  return {
    subject: `Reset your ${appName} password`,
    text: [
      `Reset your ${appName} password`,
      "",
      `Open this link within ${input.expiresInMinutes} minutes to choose a new password:`,
      input.resetUrl,
      "",
      "If you did not request this, you can ignore this email."
    ].join("\n"),
    html: brandedEmailTemplate({
      appName,
      title: "Reset your password",
      intro: `Use the secure link below to choose a new password. It expires in ${input.expiresInMinutes} minutes.`,
      ctaLabel: "Reset password",
      ctaUrl: input.resetUrl,
      footer: "If you did not request this, you can ignore this email."
    })
  };
}

export function buildEmailVerificationEmail(input: VerificationEmailInput) {
  const appName = emailAppName();
  return {
    subject: `Verify your ${appName} account`,
    text: [
      `Verify your ${appName} account`,
      "",
      `Open this link within ${input.expiresInHours} hours to verify your email address:`,
      input.verifyUrl,
      "",
      "If you did not create this account, you can ignore this email."
    ].join("\n"),
    html: brandedEmailTemplate({
      appName,
      title: "Verify your email",
      intro: `Confirm this email address to finish setting up your account. This link expires in ${input.expiresInHours} hours.`,
      ctaLabel: "Verify email",
      ctaUrl: input.verifyUrl,
      footer: "If you did not create this account, you can ignore this email."
    })
  };
}

export function buildTwoFactorEmail(input: TwoFactorEmailInput) {
  const appName = emailAppName();
  return {
    subject: `${appName} sign-in code`,
    text: [
      `Your ${appName} sign-in code is ${input.code}.`,
      "",
      `It expires in ${input.expiresInMinutes} minutes.`,
      "",
      "If you did not try to sign in, change your password."
    ].join("\n"),
    html: brandedEmailTemplate({
      appName,
      title: "Your sign-in code",
      intro: `Use this code to finish signing in. It expires in ${input.expiresInMinutes} minutes.`,
      code: input.code,
      footer: "If you did not try to sign in, change your password."
    })
  };
}

export function buildInvitationEmail(input: InvitationEmailInput) {
  const appName = emailAppName();
  const inviter = input.inviterName || input.inviterEmail || "An administrator";
  const tripText = input.tripName ? ` for ${input.tripName}` : "";
  return {
    subject: `You're invited to ${appName}`,
    text: [
      `You're invited to ${appName}`,
      "",
      `${inviter} invited you to join ${appName}${tripText}.`,
      `Open this link within ${input.expiresInDays} days to accept the invitation:`,
      input.inviteUrl,
      "",
      "If you were not expecting this invitation, you can ignore this email."
    ].join("\n"),
    html: brandedEmailTemplate({
      appName,
      title: `You're invited to ${appName}`,
      intro: `${inviter} invited you to join ${appName}${tripText}. This link expires in ${input.expiresInDays} days.`,
      ctaLabel: "Accept invitation",
      ctaUrl: input.inviteUrl,
      footer: "If you were not expecting this invitation, you can ignore this email."
    })
  };
}

function emailAppName() {
  const configuredName = process.env.EMAIL_APP_NAME?.trim();
  if (!configuredName || legacyAppNamePattern.test(configuredName)) {
    return BRAND.appName;
  }
  return configuredName;
}

function publicAssetUrl(path: string) {
  const baseUrl =
    process.env.APP_BASE_URL || process.env.PUBLIC_APP_URL || process.env.NEXTAUTH_URL;
  if (!baseUrl) return null;

  try {
    return new URL(path, baseUrl.replace(/\/$/, "") + "/").toString();
  } catch {
    return null;
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function brandedEmailTemplate(input: {
  appName: string;
  title: string;
  intro: string;
  ctaLabel?: string;
  ctaUrl?: string;
  code?: string;
  footer: string;
}) {
  const logoUrl = publicAssetUrl("/logo.png");
  const appName = escapeHtml(input.appName);
  const title = escapeHtml(input.title);
  const intro = escapeHtml(input.intro);
  const footer = escapeHtml(input.footer);
  const action = input.ctaUrl
    ? `<a href="${escapeHtml(input.ctaUrl)}" style="display:block;text-align:center;background:${BRAND.accent};color:#ffffff;text-decoration:none;border-radius:10px;padding:14px 18px;font-size:16px;font-weight:700;">${escapeHtml(input.ctaLabel || "Open SeddleUp")}</a>
       <p style="margin:20px 0 0;font-size:13px;line-height:1.5;color:${BRAND.muted};">If the button does not work, copy and paste this link into your browser:<br><span style="word-break:break-all;color:${BRAND.accent};">${escapeHtml(input.ctaUrl)}</span></p>`
    : `<div style="margin:20px 0;text-align:center;font-size:32px;letter-spacing:.24em;font-weight:800;color:${BRAND.text};">${escapeHtml(input.code || "")}</div>`;
  const logo = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" width="180" alt="SeddleUp" style="display:block;margin:0 auto 10px;max-width:180px;height:auto;border:0;outline:none;text-decoration:none;">`
    : "";

  return `
    <div style="margin:0;padding:0;background:${BRAND.background};font-family:Arial,sans-serif;color:${BRAND.text};">
      <div style="max-width:540px;margin:0 auto;padding:28px 16px;">
        <div style="background:#ffffff;border:1px solid ${BRAND.border};border-radius:14px;padding:26px;">
          <div style="margin:0 0 18px;padding:16px 12px;border-radius:12px;background:${BRAND.brandSoft};text-align:center;">
            ${logo}
            <strong style="display:block;font-size:22px;color:${BRAND.primary};">${appName}</strong>
            <span style="display:block;margin-top:4px;font-size:12px;line-height:1.4;color:${BRAND.secondary};">${BRAND.tagline}</span>
          </div>
          <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${BRAND.accent};">${BRAND.tagline}</p>
          <h1 style="margin:0 0 12px;font-size:24px;line-height:1.2;color:${BRAND.text};">${title}</h1>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:${BRAND.muted};">${intro}</p>
          ${action}
          <p style="margin:20px 0 0;font-size:13px;line-height:1.5;color:${BRAND.muted};">${footer}</p>
        </div>
      </div>
    </div>
  `;
}
