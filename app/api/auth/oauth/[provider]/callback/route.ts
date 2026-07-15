import { NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { getProviderRuntimeConfig, oauthCallbackUrl } from "@/lib/oauth-providers";
import { consumeOAuthStateCredential } from "@/lib/oauth-state";
import { bootstrapRole } from "@/lib/roles";
import { emailDomainAllowed, getAuthSettings } from "@/lib/settings";
import { writeSystemAuditLog } from "@/lib/audit";
import { timingSafeEqualOpaqueValues } from "@/lib/token-digest";
import { publicUrl } from "@/lib/url";

type ProviderProfile = {
  id: string;
  email: string | null;
  name: string | null;
  emailVerified?: boolean;
};

const sessionMaxAge = 30 * 24 * 60 * 60;

function shouldUseSecureSessionCookie() {
  return process.env.NODE_ENV === "production" && process.env.NEXTAUTH_URL?.startsWith("https://");
}

async function setOAuthSessionCookie(
  response: NextResponse,
  user: { id: string; username: string; email: string }
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
      email: user.email
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

async function providerProfile(
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
  if (provider === "google") {
    return {
      id: String(data.sub || ""),
      email: typeof data.email === "string" ? data.email.toLowerCase() : null,
      name: typeof data.name === "string" ? data.name : null,
      emailVerified: data.email_verified === true
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
    emailVerified: true
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
  const linkUserId = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`oauth_link_${provider}=`))
    ?.split("=")[1];

  const redirect = (path: string) => {
    const response = NextResponse.redirect(publicUrl(path, request));
    response.cookies.delete(`oauth_state_${provider}`);
    response.cookies.delete(`oauth_pkce_${provider}`);
    response.cookies.delete(`oauth_link_${provider}`);
    return response;
  };

  const validState =
    code && state && stateCookie && verifier && timingSafeEqualOpaqueValues(state, stateCookie)
      ? await consumeOAuthStateCredential({ state, verifier, providerId: provider })
      : false;
  if (!code || !state || !verifier || !validState) {
    await writeSystemAuditLog({
      action: "auth.oauth_callback.invalid_state",
      targetType: "auth_provider",
      targetId: provider
    });
    return redirect("/login?oauth=invalid");
  }

  const exchanged = await exchangeCode({ provider, code, verifier, request });
  if (!exchanged) return redirect("/login?oauth=token");

  const profile = await providerProfile(provider, exchanged.token);
  if (!profile?.id || !profile.email) return redirect("/login?oauth=profile");
  const profileEmail = profile.email;

  if (linkUserId) {
    const linkUser = await prisma.user.findUnique({
      where: { id: linkUserId },
      select: { id: true, disabledAt: true }
    });
    if (!linkUser || linkUser.disabledAt) return redirect("/login?oauth=invalid");

    const existing = await prisma.userAuthAccount.findUnique({
      where: {
        providerId_providerAccountId: { providerId: provider, providerAccountId: profile.id }
      }
    });
    if (existing && existing.userId !== linkUserId) return redirect("/account?link=duplicate");
    await prisma.userAuthAccount.upsert({
      where: { userId_providerId: { userId: linkUserId, providerId: provider } },
      create: {
        userId: linkUserId,
        providerId: provider,
        providerAccountId: profile.id,
        email: profileEmail
      },
      update: { providerAccountId: profile.id, email: profileEmail }
    });
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

  const account = await prisma.userAuthAccount.findUnique({
    where: {
      providerId_providerAccountId: { providerId: provider, providerAccountId: profile.id }
    },
    include: { user: true }
  });
  let user = account?.user || null;

  if (!user) {
    const existingUser = await prisma.user.findUnique({ where: { email: profileEmail } });
    if (existingUser) {
      user = existingUser;
      await prisma.userAuthAccount.create({
        data: {
          userId: user.id,
          providerId: provider,
          providerAccountId: profile.id,
          email: profileEmail
        }
      });
    } else if (settings.publicRegistrationEnabled) {
      user = await prisma.$transaction(async (tx) => {
        const count = await tx.user.count();
        const created = await tx.user.create({
          data: {
            username: profile.name || profileEmail.split("@")[0],
            email: profileEmail,
            passwordHash: "",
            role: bootstrapRole(count, settings.defaultUserRole),
            emailVerifiedAt: profile.emailVerified ? new Date() : null,
            authAccounts: {
              create: {
                providerId: provider,
                providerAccountId: profile.id,
                email: profileEmail
              }
            }
          }
        });
        return created;
      });
    }
  }

  if (!user || user.disabledAt) return redirect("/login?oauth=denied");
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const response = redirect("/dashboard");
  await setOAuthSessionCookie(response, user);
  return response;
}
