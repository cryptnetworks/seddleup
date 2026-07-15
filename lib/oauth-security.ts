import type { OAuthStatePurpose } from "@/lib/oauth-state";

export function boundOAuthLinkUser(input: {
  purpose: OAuthStatePurpose;
  stateUserId: string | null;
  sessionUserId?: string;
}) {
  if (input.purpose !== "link") return input.stateUserId ? null : undefined;
  if (!input.stateUserId || input.sessionUserId !== input.stateUserId) return null;
  return input.stateUserId;
}

export function oauthRegistrationDecision(input: {
  providerAccountExists: boolean;
  emailAccountExists: boolean;
  publicRegistrationEnabled: boolean;
  providerEmailVerified: boolean;
}) {
  if (input.providerAccountExists) return "existing" as const;
  if (input.emailAccountExists) return "email_conflict" as const;
  if (!input.publicRegistrationEnabled) return "registration_disabled" as const;
  if (!input.providerEmailVerified) return "unverified" as const;
  return "create" as const;
}
