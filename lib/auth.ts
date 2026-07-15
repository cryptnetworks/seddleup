import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import * as bcrypt from "bcryptjs";
import { logger } from "@/lib/logger";
import { consumeSessionLoginToken } from "@/lib/login-token";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { getAuthSettings } from "@/lib/settings";
import {
  startEmailTwoFactorChallenge,
  verifyAuthenticatorCode,
  verifyEmailTwoFactorCode
} from "@/lib/two-factor";
import { loginSchema } from "@/lib/validation";

const useSecureCookies =
  process.env.NODE_ENV === "production" && process.env.NEXTAUTH_URL?.startsWith("https://");

function logLoginDebug(fields: {
  email?: string;
  userId?: string;
  userFound?: boolean;
  passwordVerified?: boolean;
  mfaRequired?: boolean;
  stepFailed?: string;
}) {
  if (process.env.NODE_ENV !== "development") return;
  logger.info("auth.login.debug", fields);
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60
  },
  pages: {
    signIn: "/login"
  },
  useSecureCookies,
  cookies: useSecureCookies
    ? {
        sessionToken: {
          name: "__Secure-next-auth.session-token",
          options: {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            secure: true
          }
        },
        callbackUrl: {
          name: "__Secure-next-auth.callback-url",
          options: {
            sameSite: "lax",
            path: "/",
            secure: true
          }
        },
        csrfToken: {
          name: "__Host-next-auth.csrf-token",
          options: {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            secure: true
          }
        }
      }
    : undefined,
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        twoFactorCode: { label: "Verification code", type: "text" },
        loginToken: { label: "Login token", type: "text" }
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse({
          email: credentials?.email,
          password: credentials?.password,
          twoFactorCode: credentials?.twoFactorCode,
          loginToken: credentials?.loginToken
        });

        if (!parsed.success) {
          logger.warn("auth.login.validation_failed");
          return null;
        }

        const { email, password, twoFactorCode, loginToken } = parsed.data;

        if (loginToken) {
          const loginUser = await consumeSessionLoginToken(loginToken);
          if (!loginUser || loginUser.disabledAt) {
            logger.warn("auth.login_token.invalid");
            return null;
          }

          logger.info("auth.login_token.success", { userId: loginUser.id });
          return {
            id: loginUser.id,
            name: loginUser.username,
            email: loginUser.email
          };
        }

        if (!password) {
          logLoginDebug({ email, stepFailed: "missing_password" });
          return null;
        }

        const settings = await getAuthSettings();
        if (!settings.localAuthEnabled) {
          logger.warn("auth.login.local_disabled", { email });
          logLoginDebug({ email, stepFailed: "local_auth_disabled" });
          return null;
        }
        const rateLimit = checkRateLimit(`login:${email}`, {
          limit: 8,
          windowMs: 15 * 60 * 1000
        });
        if (!rateLimit.allowed) {
          logger.warn("auth.login.rate_limited", { email });
          logLoginDebug({ email, stepFailed: "rate_limited" });
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email } });
        logLoginDebug({ email, userFound: Boolean(user) });
        if (!user) {
          logger.warn("auth.login.unknown_user", { email });
          logLoginDebug({ email, stepFailed: "unknown_user" });
          return null;
        }

        if (user.disabledAt) {
          logger.warn("auth.login.disabled_user", { email, userId: user.id });
          logLoginDebug({ email, userId: user.id, stepFailed: "disabled_user" });
          return null;
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);
        logLoginDebug({ email, userId: user.id, passwordVerified: isValid });
        if (!isValid) {
          logger.warn("auth.login.invalid_password", { email, userId: user.id });
          logLoginDebug({ email, userId: user.id, stepFailed: "invalid_password" });
          return null;
        }

        if (!user.emailVerifiedAt) {
          logger.warn("auth.login.email_unverified", { email, userId: user.id });
          logLoginDebug({ email, userId: user.id, stepFailed: "email_unverified" });
          throw new Error("EMAIL_VERIFICATION_REQUIRED");
        }

        if (user.twoFactorMethod === "email") {
          logLoginDebug({ email, userId: user.id, mfaRequired: true });
          if (!twoFactorCode) {
            await startEmailTwoFactorChallenge(user);
            logLoginDebug({ email, userId: user.id, stepFailed: "email_mfa_required" });
            throw new Error("EMAIL_OTP_REQUIRED");
          }

          if (!(await verifyEmailTwoFactorCode(user.id, twoFactorCode))) {
            logLoginDebug({ email, userId: user.id, stepFailed: "invalid_email_mfa_code" });
            throw new Error("INVALID_MFA_CODE");
          }
        }

        if (user.twoFactorMethod === "authenticator") {
          logLoginDebug({ email, userId: user.id, mfaRequired: true });
          if (!user.authenticatorEnabled || !user.authenticatorSecretEncrypted) {
            logger.error("auth.login.mfa_misconfigured", {
              email,
              userId: user.id,
              method: user.twoFactorMethod,
              authenticatorEnabled: user.authenticatorEnabled
            });
            logLoginDebug({ email, userId: user.id, stepFailed: "mfa_misconfigured" });
            throw new Error("MFA_MISCONFIGURED");
          }

          if (!twoFactorCode) {
            logLoginDebug({ email, userId: user.id, stepFailed: "authenticator_mfa_required" });
            throw new Error("AUTHENTICATOR_OTP_REQUIRED");
          }

          if (
            !(await verifyAuthenticatorCode(
              {
                id: user.id,
                authenticatorSecretEncrypted: user.authenticatorSecretEncrypted
              },
              twoFactorCode
            ))
          ) {
            logLoginDebug({ email, userId: user.id, stepFailed: "invalid_authenticator_mfa_code" });
            throw new Error("INVALID_MFA_CODE");
          }
        }

        logger.info("auth.login.success", { email, userId: user.id });
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() }
        });
        return {
          id: user.id,
          name: user.username,
          email: user.email
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    }
  },
  events: {
    async signOut({ token }) {
      logger.info("auth.logout", { userId: token?.id as string | undefined });
    }
  }
};
