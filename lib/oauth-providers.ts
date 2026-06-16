import crypto from "crypto";
import { decryptSecret, encryptSecret } from "@/lib/secret-encryption";
import { prisma } from "@/lib/prisma";
import { publicBaseUrl } from "@/lib/url";

export type OAuthProviderId = "google" | "github" | "discord" | "facebook" | "test";

export type OAuthProviderDefinition = {
  id: OAuthProviderId;
  name: string;
  defaultScopes: string[];
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
};

export const oauthProviderDefinitions: OAuthProviderDefinition[] = [
  {
    id: "google",
    name: "Google",
    defaultScopes: ["openid", "email", "profile"],
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://openidconnect.googleapis.com/v1/userinfo"
  },
  {
    id: "github",
    name: "GitHub",
    defaultScopes: ["read:user", "user:email"],
    authorizationUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    userInfoUrl: "https://api.github.com/user"
  },
  {
    id: "discord",
    name: "Discord",
    defaultScopes: ["identify", "email"],
    authorizationUrl: "https://discord.com/oauth2/authorize",
    tokenUrl: "https://discord.com/api/oauth2/token",
    userInfoUrl: "https://discord.com/api/users/@me"
  },
  {
    id: "facebook",
    name: "Facebook",
    defaultScopes: ["email", "public_profile"],
    authorizationUrl: "https://www.facebook.com/v20.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v20.0/oauth/access_token",
    userInfoUrl: "https://graph.facebook.com/me?fields=id,name,email"
  }
];

export function testOAuthEnabled() {
  return (
    process.env.NODE_ENV !== "production" && process.env.TEST_OAUTH_PROVIDER_ENABLED === "true"
  );
}

function testOAuthProviderDefinition(): OAuthProviderDefinition {
  const baseUrl = publicBaseUrl();
  return {
    id: "test",
    name: "Test OAuth",
    defaultScopes: ["openid", "email", "profile"],
    authorizationUrl: `${baseUrl}/api/test/oauth/authorize`,
    tokenUrl: `${baseUrl}/api/test/oauth/token`,
    userInfoUrl: `${baseUrl}/api/test/oauth/userinfo`
  };
}

function allProviderDefinitions() {
  return testOAuthEnabled()
    ? [...oauthProviderDefinitions, testOAuthProviderDefinition()]
    : oauthProviderDefinitions;
}

export function providerDefinition(providerId: string) {
  return allProviderDefinitions().find((provider) => provider.id === providerId);
}

export async function ensureProviderConfigs() {
  await prisma.$transaction(
    allProviderDefinitions().map((provider) =>
      prisma.authProviderConfig.upsert({
        where: { id: provider.id },
        create: {
          id: provider.id,
          name: provider.name,
          enabled: false,
          scopesJson: JSON.stringify(provider.defaultScopes)
        },
        update: {}
      })
    )
  );
}

export async function listAuthProviders() {
  await ensureProviderConfigs();
  const configs = await prisma.authProviderConfig.findMany({ orderBy: { name: "asc" } });
  return configs.map((config) => ({
    ...config,
    scopes: JSON.parse(config.scopesJson) as string[],
    hasSecret: Boolean(config.encryptedClientSecret),
    encryptedClientSecret: undefined
  }));
}

export async function enabledLoginProviders() {
  const providers = await listAuthProviders();
  return providers.filter(
    (provider) => provider.enabled && provider.clientId && provider.hasSecret
  );
}

export async function getProviderRuntimeConfig(providerId: string) {
  const definition = providerDefinition(providerId);
  if (!definition) return null;

  if (providerId === "test" && testOAuthEnabled()) {
    return {
      definition,
      clientId: "triptally-test-client",
      clientSecret: "triptally-test-secret",
      scopes: definition.defaultScopes
    };
  }

  const config = await prisma.authProviderConfig.findUnique({ where: { id: providerId } });
  if (!config?.enabled || !config.clientId || !config.encryptedClientSecret) return null;

  return {
    definition,
    clientId: config.clientId,
    clientSecret: decryptSecret(config.encryptedClientSecret),
    scopes: JSON.parse(config.scopesJson) as string[]
  };
}

export function encryptProviderSecret(secret: string) {
  return encryptSecret(secret);
}

export function oauthCallbackUrl(providerId: string, request?: Request) {
  return `${publicBaseUrl(request)}/api/auth/oauth/${providerId}/callback`;
}

export function generateOAuthState() {
  return crypto.randomBytes(24).toString("base64url");
}

export function generatePkceVerifier() {
  return crypto.randomBytes(32).toString("base64url");
}

export function pkceChallenge(verifier: string) {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}
