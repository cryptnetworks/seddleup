import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { encode } from "next-auth/jwt";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProviderRuntimeConfig, oauthCallbackUrl } from "@/lib/oauth-providers";
import { consumeOAuthStateCredential } from "@/lib/oauth-state";
import { bootstrapRole } from "@/lib/roles";
import { emailDomainAllowed, getAuthSettings } from "@/lib/settings";
import { writeSystemAuditLog } from "@/lib/audit";
import { timingSafeEqualOpaqueValues } from "@/lib/token-digest";
import { publicUrl } from "@/lib/url";
import { revokeUserSessionsInTransaction } from "@/lib/session-revocation";
import { boundOAuthLinkUser, oauthRegistrationDecision } from "@/lib/oauth-security";

type ProviderProfile = {
  id: string;
  email: string | null;
  name: string | null;
  emailVerified: boolean;
};

const sessionMaxAge = 30 * 24 * 60 * 60;

function shouldUseSecureSessionCookie() {
  return process.env.NODE_ENV === "production" && process.env.NEXTAUTH_URL?.startsWith("https://");
}

async function setOAuthSessionCookie(
  response: NextResponse,
  user: { id: string; username: string; email: string; sessionVersion: number }
) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required for OAuth session creation.");

  const sessionToken = await encode({
    secret,
    maxAge: sessionMaxAge,
    token: {
      id: user.id,
      sub: user.id,
      name: user.username,
      email: user.email,
      sessionVersion: user.sessionVersion
    }
  });
  response.cookies.set(
    shouldUseSecureSessionCookie() ? "__Secure-next-auth.session-token" : "next-auth.session-token",
    sessionToken,
    {
      httpOnly: true,
      sameSite: "lax",
      secure: shouldUseSecureSessionCookie(),
      maxAge: sessionMaxAge,
      path: "/"
    }
  );
}

async function exchangeCode(input: {
  provider: string;
  code: string;
  verifier: string;
  request: Request;
}) {
  const config = await getProviderRuntimeConfig(input.provider);
  if (!config) return null;

  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code: input.code,
    redirect_uri: oauthCallbackUrl(input.provider, input.request),
    grant_type: "authorization_code",
    code_verifier: input.verifier
  });

  const response = await fetch(config.definition.tokenUrl, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (!response.ok) return null;
  const token = (await response.json()) as { access_token?: string; token_type?: string };
  if (!token.access_token) return null;
  return { token: token.access_token, config };
}

export async function providerProfile(
  provider: string,
  accessToken: string
): Promise<ProviderProfile | null> {
  const config = await getProviderRuntimeConfig(provider);
  if (!config) return null;

  const response = await fetch(config.definition.userInfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "User-Agent": "SeddleUp"
    }
  });
  if (!response.ok) return null;

  const data = (await response.json()) as Record<string, unknown>;
  if (provider === "google" || provider === "test") {
    return {
      id: String(data.sub || ""),
      email: typeof data.email === "string" ? data.email.toLowerCase() : null,
      name: typeof data.name === "string" ? data.name : null,
      emailVerified: data.email_verified === true
    };
  }
  if (provider === "github") {
    const emailsResponse = await fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "SeddleUp"
      }
    });
    if (!emailsResponse.ok) return null;
    const emails = (await emailsResponse.json()) as Array<Record<string, unknown>>;
    const primaryEmail = emails.find(
      (candidate) => candidate.primary === true && candidate.verified === true
    );
    return {
      id: String(data.id || ""),
      email: typeof primaryEmail?.email === "string" ? primaryEmail.email.toLowerCase() : null,
      name:
        typeof data.name === "string"
          ? data.name
          : typeof data.login === "string"
            ? data.login
            : null,
      emailVerified: Boolean(primaryEmail)
    };
  }
  if (provider === "discord") {
    return {
      id: String(data.id || ""),
      email: typeof data.email === "string" ? data.email.toLowerCase() : null,
      name:
        typeof data.global_name === "string"
          ? data.global_name
          : typeof data.username === "string"
            ? data.username
            : null,
      emailVerified: data.verified === true
    };
  }
  return {
    id: String(data.id || ""),
    email: typeof data.email === "string" ? data.email.toLowerCase() : null,
    name:
      typeof data.name === "string"
        ? data.name
        : typeof data.username === "string"
          ? data.username
          : null,
    emailVerified: false
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const stateCookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`oauth_state_${provider}=`))
    ?.split("=")[1];
  const verifier = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`oauth_pkce_${provider}=`))
    ?.split("=")[1];
  const redirect = (path: string) => {
    const response = NextResponse.redirect(publicUrl(path, request));
    response.cookies.delete(`oauth_state_${provider}`);
    response.cookies.delete(`oauth_pkce_${provider}`);
    return response;
  };

  const consumedState =
    code && state && stateCookie && verifier && timingSafeEqualOpaqueValues(state, stateCookie)
      ? await consumeOAuthStateCredential({ state, verifier, providerId: provider })
      : null;
  if (!code || !state || !verifier || !consumedState) {
    await writeSystemAuditLog({
      action: "auth.oauth_callback.invalid_state",
      targetType: "auth_provider",
      targetId: provider
    });
    return redirect("/login?oauth=invalid");
  }

  let linkUserId: string | null = null;
  if (consumedState.purpose === "link") {
    const session = await getServerSession(authOptions);
    const boundUserId = boundOAuthLinkUser({
      purpose: consumedState.purpose,
      stateUserId: consumedState.userId,
      sessionUserId: session?.user?.id
    });
    if (!boundUserId || !session?.user) {
      return redirect("/login?oauth=invalid");
    }
    const linkUser = await prisma.user.findUnique({
      where: { id: boundUserId },
      select: { id: true, disabledAt: true, emailVerifiedAt: true, sessionVersion: true }
    });
    if (
      !linkUser ||
      linkUser.disabledAt ||
      !linkUser.emailVerifiedAt ||
      linkUser.sessionVersion !== session.user.sessionVersion
    ) {
      return redirect("/login?oauth=invalid");
    }
    linkUserId = linkUser.id;
  } else if (
    boundOAuthLinkUser({
      purpose: consumedState.purpose,
      stateUserId: consumedState.userId
    }) === null
  ) {
    return redirect("/login?oauth=invalid");
  }

  const exchanged = await exchangeCode({ provider, code, verifier, request });
  if (!exchanged) return redirect("/login?oauth=token");

  const profile = await providerProfile(provider, exchanged.token);
  if (!profile?.id || !profile.email) return redirect("/login?oauth=profile");
  const profileEmail = profile.email;

  if (linkUserId) {
    let linked = false;
    try {
      linked = await prisma.$transaction(async (tx) => {
        const existing = await tx.userAuthAccount.findUnique({
          where: {
            providerId_providerAccountId: { providerId: provider, providerAccountId: profile.id }
          }
        });
        if (existing && existing.userId !== linkUserId) return false;
        await tx.userAuthAccount.upsert({
          where: { userId_providerId: { userId: linkUserId, providerId: provider } },
          create: {
            userId: linkUserId,
            providerId: provider,
            providerAccountId: profile.id,
            email: profileEmail
          },
          update: { providerAccountId: profile.id, email: profileEmail }
        });
        await revokeUserSessionsInTransaction(tx, linkUserId);
        return true;
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
        throw error;
      }
    }
    if (!linked) return redirect("/account?link=duplicate");
    await writeSystemAuditLog({
      action: "auth.account_linked",
      targetType: "user",
      targetId: linkUserId,
      metadata: { provider }
    });
    return redirect("/account?link=success");
  }

  const settings = await getAuthSettings();
  if (!emailDomainAllowed(profileEmail, settings.allowedEmailDomains)) {
    return redirect("/login?oauth=domain");
  }

  let account = await prisma.userAuthAccount.findUnique({
    where: {
      providerId_providerAccountId: { providerId: provider, providerAccountId: profile.id }
    },
    include: { user: true }
  });
  let user = account?.user || null;

  if (!user) {
    const existingUser = await prisma.user.findUnique({ where: { email: profileEmail } });
    const registrationDecision = oauthRegistrationDecision({
      providerAccountExists: false,
      emailAccountExists: Boolean(existingUser),
      publicRegistrationEnabled: settings.publicRegistrationEnabled,
      providerEmailVerified: profile.emailVerified
    });
    if (registrationDecision === "email_conflict") {
      return redirect("/login?oauth=existing");
    }
    if (registrationDecision === "registration_disabled") return redirect("/login?oauth=denied");
    if (registrationDecision === "unverified") return redirect("/login?oauth=unverified");

    try {
      user = await prisma.$transaction(async (tx) => {
        const count = await tx.user.count();
        return tx.user.create({
          data: {
            username: profile.name || profileEmail.split("@")[0],
            email: profileEmail,
            passwordHash: "",
            role: bootstrapRole(count, settings.defaultUserRole),
            emailVerifiedAt: new Date(),
            authAccounts: {
              create: {
                providerId: provider,
                providerAccountId: profile.id,
                email: profileEmail
              }
            }
          }
        });
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
        throw error;
      }
      account = await prisma.userAuthAccount.findUnique({
        where: {
          providerId_providerAccountId: { providerId: provider, providerAccountId: profile.id }
        },
        include: { user: true }
      });
      user = account?.user ?? null;
    }
  }

  if (!user || user.disabledAt || !user.emailVerifiedAt) return redirect("/login?oauth=denied");
  user = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() }
  });
  const response = redirect("/dashboard");
  await setOAuthSessionCookie(response, user);
  return response;
}
