"use server";

import * as bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { assertSameOriginRequest } from "@/lib/csrf";
import { emailDeliveryAvailable } from "@/lib/email";
import { logger } from "@/lib/logger";
import { createEmailVerificationForUser, verifyEmailToken } from "@/lib/email-verification";
import { completePasswordReset, createPasswordResetForUser } from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { bootstrapRole } from "@/lib/roles";
import { emailDomainAllowed, getAuthSettings } from "@/lib/settings";
import { acceptInvitationForExistingUser, acceptInvitationWithNewUser } from "@/lib/invitations";
import {
  createAuthenticatorSetup,
  enableAuthenticator,
  type TwoFactorMethod,
  twoFactorMethods
} from "@/lib/two-factor";
import {
  accountPasswordSchema,
  accountProfileSchema,
  acceptInvitationSchema,
  forgotPasswordSchema,
  formString,
  registerSchema,
  resetPasswordSchema,
  twoFactorCodeSchema,
  verificationTokenSchema
} from "@/lib/validation";
import { requireUser } from "@/lib/session";
import { revokeUserSessionsInTransaction } from "@/lib/session-revocation";

export async function registerUser(formData: FormData) {
  await assertSameOriginRequest("auth.register");
  const parsed = registerSchema.safeParse({
    username: formString(formData, "username"),
    email: formString(formData, "email"),
    password: formString(formData, "password"),
    confirmPassword: formString(formData, "confirmPassword")
  });

  if (!parsed.success) {
    logger.warn("auth.register.validation_failed");
    redirect("/register?error=invalid");
  }

  const email = parsed.data.email;
  const settings = await getAuthSettings();
  if (!settings.publicRegistrationEnabled) {
    logger.warn("auth.register.disabled");
    redirect("/register?error=disabled");
  }
  if (!emailDomainAllowed(email, settings.allowedEmailDomains)) {
    logger.warn("auth.register.email_domain_blocked", { email });
    redirect("/register?error=domain");
  }

  const rateLimit = checkRateLimit(`register:${email}`, {
    limit: 5,
    windowMs: 15 * 60 * 1000
  });
  if (!rateLimit.allowed) {
    logger.warn("auth.register.rate_limited", { email });
    redirect("/register?error=rate-limit");
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { username: parsed.data.username }]
    }
  });

  if (existingUser) {
    logger.warn("auth.register.duplicate", { email });
    redirect("/register?error=exists");
  }

  const user = await prisma.$transaction(async (tx) => {
    const userCount = await tx.user.count();
    return tx.user.create({
      data: {
        username: parsed.data.username,
        email,
        role: bootstrapRole(userCount, settings.defaultUserRole),
        emailVerifiedAt: settings.requireEmailVerification ? null : new Date(),
        passwordHash: await bcrypt.hash(parsed.data.password, 12)
      }
    });
  });

  if (settings.requireEmailVerification) {
    await createEmailVerificationForUser(user);
  }

  logger.info("auth.register.created", { email, role: user.role });
  redirect(
    settings.requireEmailVerification ? "/login?registered=1&verify=1" : "/login?registered=1"
  );
}

export async function requestPasswordReset(formData: FormData) {
  await assertSameOriginRequest("auth.password_reset.request");
  const parsed = forgotPasswordSchema.safeParse({
    email: formString(formData, "email")
  });

  if (!parsed.success) {
    logger.warn("auth.password_reset.request.validation_failed");
    redirect("/forgot-password?sent=1");
  }

  const email = parsed.data.email;
  const rateLimit = checkRateLimit(`password-reset:${email}`, {
    limit: 3,
    windowMs: 60 * 60 * 1000
  });

  if (!rateLimit.allowed) {
    logger.warn("auth.password_reset.request.rate_limited", { email });
    redirect("/forgot-password?sent=1");
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    await createPasswordResetForUser(user);
  } else {
    logger.info("auth.password_reset.request.accepted_unknown_email");
  }

  redirect("/forgot-password?sent=1");
}

export async function resetPassword(formData: FormData) {
  await assertSameOriginRequest("auth.password_reset.complete");
  const token = formString(formData, "token");
  const parsed = resetPasswordSchema.safeParse({
    token,
    password: formString(formData, "password"),
    confirmPassword: formString(formData, "confirmPassword")
  });

  if (!parsed.success) {
    logger.warn("auth.password_reset.validation_failed");
    redirect("/reset-password?error=invalid");
  }

  const success = await completePasswordReset(parsed.data.token, parsed.data.password);
  if (!success) {
    redirect("/reset-password?error=invalid");
  }

  redirect("/login?reset=1");
}

export async function verifyEmailAddress(formData: FormData) {
  await assertSameOriginRequest("auth.email_verification.verify");
  const token = formString(formData, "token");
  const parsed = verificationTokenSchema.safeParse(token);

  if (!parsed.success) {
    redirect("/verify-email?error=invalid");
  }

  const success = await verifyEmailToken(parsed.data);
  redirect(success ? "/login?verified=1" : "/verify-email?error=invalid");
}

export async function resendVerificationEmail(formData: FormData) {
  await assertSameOriginRequest("auth.email_verification.resend");
  const email = formString(formData, "email").trim().toLowerCase();
  const rateLimit = checkRateLimit(`email-verification:${email}`, {
    limit: 3,
    windowMs: 60 * 60 * 1000
  });

  if (!rateLimit.allowed) {
    logger.warn("auth.email_verification.resend.rate_limited", { email });
    redirect("/login?verificationSent=1");
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (user && !user.emailVerifiedAt) {
    await createEmailVerificationForUser(user);
  }

  redirect("/login?verificationSent=1");
}

function invitationRedirectForResult(
  result: Awaited<ReturnType<typeof acceptInvitationForExistingUser>>
) {
  if (result.ok) {
    redirect(
      result.tripId ? `/trips/${result.tripId}?invite=accepted` : "/dashboard?invite=accepted"
    );
  }
  redirect(`/invite/accept?error=${result.reason}`);
}

export async function acceptInvitationAsCurrentUser(formData: FormData) {
  await assertSameOriginRequest("invitation.accept.current_user");
  const sessionUser = await requireUser();
  const token = formString(formData, "token");
  const parsed = verificationTokenSchema.safeParse(token);
  if (!parsed.success) {
    redirect("/invite/accept?error=invalid");
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: sessionUser.id },
    select: { id: true, email: true }
  });
  const result = await acceptInvitationForExistingUser(parsed.data, user);
  invitationRedirectForResult(result);
}

export async function acceptInvitationAndCreateAccount(formData: FormData) {
  await assertSameOriginRequest("invitation.accept.new_user");
  const parsed = acceptInvitationSchema.safeParse({
    token: formString(formData, "token"),
    username: formString(formData, "username"),
    password: formString(formData, "password"),
    confirmPassword: formString(formData, "confirmPassword")
  });

  if (!parsed.success) {
    redirect(
      `/invite/accept?token=${encodeURIComponent(formString(formData, "token"))}&error=invalid-form`
    );
  }

  const rateLimit = checkRateLimit(`invite-accept:${parsed.data.token}`, {
    limit: 5,
    windowMs: 15 * 60 * 1000
  });
  if (!rateLimit.allowed) {
    redirect(`/invite/accept?token=${encodeURIComponent(parsed.data.token)}&error=rate-limit`);
  }

  const result = await acceptInvitationWithNewUser(parsed.data);
  if (result.ok) {
    redirect("/login?registered=1&verified=1");
  }
  redirect(`/invite/accept?token=${encodeURIComponent(parsed.data.token)}&error=${result.reason}`);
}

export async function updateAccountProfile(formData: FormData) {
  await assertSameOriginRequest("account.profile.update");
  const user = await requireUser();
  const parsed = accountProfileSchema.safeParse({
    username: formString(formData, "username"),
    email: formString(formData, "email")
  });

  if (!parsed.success) {
    logger.warn("account.profile.validation_failed", { userId: user.id });
    redirect("/account?profile=invalid");
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ username: parsed.data.username }, { email: parsed.data.email }],
      NOT: { id: user.id }
    }
  });

  if (existingUser) {
    logger.warn("account.profile.duplicate", { userId: user.id });
    redirect("/account?profile=duplicate");
  }

  const currentUser = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { email: true }
  });
  const emailChanged = currentUser.email !== parsed.data.email;

  const updatedUser = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: user.id },
      data: {
        username: parsed.data.username,
        email: parsed.data.email,
        emailVerifiedAt: emailChanged ? null : undefined
      }
    });
    if (emailChanged) await revokeUserSessionsInTransaction(tx, user.id);
    return updated;
  });

  if (emailChanged) {
    await createEmailVerificationForUser(updatedUser);
  }

  logger.info("account.profile.updated", { userId: user.id });
  redirect(emailChanged ? "/account?profile=verify-email" : "/account?profile=updated");
}

export async function updateAccountPassword(formData: FormData) {
  await assertSameOriginRequest("account.password.update");
  const sessionUser = await requireUser();
  const parsed = accountPasswordSchema.safeParse({
    currentPassword: formString(formData, "currentPassword"),
    password: formString(formData, "password"),
    confirmPassword: formString(formData, "confirmPassword")
  });

  if (!parsed.success) {
    logger.warn("account.password.validation_failed", { userId: sessionUser.id });
    redirect("/account?password=invalid");
  }

  const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
  if (!user) {
    logger.warn("account.password.missing_user", { userId: sessionUser.id });
    redirect("/login");
  }

  const currentPasswordMatches = await bcrypt.compare(
    parsed.data.currentPassword,
    user.passwordHash
  );

  if (!currentPasswordMatches) {
    logger.warn("account.password.invalid_current", { userId: user.id });
    redirect("/account?password=current");
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
    await revokeUserSessionsInTransaction(tx, user.id);
  });

  logger.info("account.password.updated", { userId: user.id });
  redirect("/account?password=updated");
}

export async function setTwoFactorMethod(formData: FormData) {
  await assertSameOriginRequest("account.two_factor.update");
  const user = await requireUser();
  const method = formString(formData, "method") as TwoFactorMethod;

  if (!twoFactorMethods.includes(method)) {
    redirect("/account?twoFactor=invalid");
  }

  const dbUser = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: {
      authenticatorEnabled: true,
      twoFactorMethod: true
    }
  });

  const enablingEmailMfa = method === "email" && dbUser.twoFactorMethod !== "email";
  if (enablingEmailMfa && !emailDeliveryAvailable()) {
    logger.warn("account.two_factor.email_unavailable", { userId: user.id });
    redirect("/account?twoFactor=email-unavailable");
  }

  if (method === "authenticator" && !dbUser.authenticatorEnabled) {
    redirect("/account?twoFactor=setup-required");
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { twoFactorMethod: method } });
    await revokeUserSessionsInTransaction(tx, user.id);
  });

  logger.info("account.two_factor.method_updated", { userId: user.id, method });
  redirect("/account?twoFactor=updated");
}

export async function startAuthenticatorSetup() {
  await assertSameOriginRequest("account.two_factor.authenticator.start");
  const sessionUser = await requireUser();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: sessionUser.id },
    select: { id: true, email: true }
  });
  await createAuthenticatorSetup(user);

  redirect("/account?twoFactor=authenticator-setup");
}

export async function verifyAuthenticatorSetup(formData: FormData) {
  await assertSameOriginRequest("account.two_factor.authenticator.verify");
  const user = await requireUser();
  const parsed = twoFactorCodeSchema.safeParse({
    code: formString(formData, "code")
  });

  if (!parsed.success) {
    redirect("/account?twoFactor=invalid-code");
  }

  const success = await enableAuthenticator(user.id, parsed.data.code);
  redirect(
    success ? "/account?twoFactor=authenticator-enabled" : "/account?twoFactor=invalid-code"
  );
}

export async function unlinkAuthProvider(formData: FormData) {
  await assertSameOriginRequest("account.oauth.unlink");
  const user = await requireUser();
  const providerId = formString(formData, "providerId");
  const dbUser = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    include: { authAccounts: true }
  });

  const hasLocalPassword = Boolean(dbUser.passwordHash);
  if (!hasLocalPassword && dbUser.authAccounts.length <= 1) {
    redirect("/account?link=final-method");
  }

  await prisma.$transaction(async (tx) => {
    await tx.userAuthAccount.delete({
      where: { userId_providerId: { userId: user.id, providerId } }
    });
    await revokeUserSessionsInTransaction(tx, user.id);
  });

  logger.info("auth.account_unlinked", { userId: user.id, providerId });
  redirect("/account?link=removed");
}
