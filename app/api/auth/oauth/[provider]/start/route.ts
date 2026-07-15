import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  generateOAuthState,
  generatePkceVerifier,
  getProviderRuntimeConfig,
  oauthCallbackUrl,
  pkceChallenge
} from "@/lib/oauth-providers";
import { createOAuthStateCredential } from "@/lib/oauth-state";
import { isSameOriginRequest } from "@/lib/csrf";
import { publicUrl } from "@/lib/url";

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const purpose = new URL(request.url).searchParams.get("purpose") === "link" ? "link" : "login";
  const config = await getProviderRuntimeConfig(provider);
  if (!config) {
    return NextResponse.redirect(publicUrl("/login?oauth=disabled", request));
  }

  const session = await getServerSession(authOptions);
  const state = generateOAuthState();
  const verifier = generatePkceVerifier();
  let linkUserId: string | undefined;
  if (purpose === "link") {
    if (!session?.user?.id || !isSameOriginRequest(request.headers)) {
      return NextResponse.redirect(publicUrl("/login?oauth=invalid", request));
    }
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, disabledAt: true, emailVerifiedAt: true, sessionVersion: true }
    });
    if (
      !user ||
      user.disabledAt ||
      !user.emailVerifiedAt ||
      user.sessionVersion !== session.user.sessionVersion
    ) {
      return NextResponse.redirect(publicUrl("/login?oauth=invalid", request));
    }
    linkUserId = user.id;
  }
  await createOAuthStateCredential({
    state,
    verifier,
    providerId: provider,
    purpose,
    userId: linkUserId
  });
  const url = new URL(config.definition.authorizationUrl);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", oauthCallbackUrl(provider, request));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.scopes.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", pkceChallenge(verifier));
  url.searchParams.set("code_challenge_method", "S256");

  const response = NextResponse.redirect(url);
  response.cookies.set(`oauth_state_${provider}`, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/"
  });
  response.cookies.set(`oauth_pkce_${provider}`, verifier, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/"
  });
  return response;
}
