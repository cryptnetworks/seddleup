import { describe, expect, it } from "vitest";
import { boundOAuthLinkUser, oauthRegistrationDecision } from "@/lib/oauth-security";

describe("OAuth trust-boundary decisions", () => {
  it("never uses a login-purpose state for account linking", () => {
    expect(
      boundOAuthLinkUser({ purpose: "login", stateUserId: null, sessionUserId: "user-1" })
    ).toBeUndefined();
    expect(
      boundOAuthLinkUser({ purpose: "login", stateUserId: "user-1", sessionUserId: "user-1" })
    ).toBeNull();
  });

  it("requires the state and live session to name the same linking user", () => {
    expect(
      boundOAuthLinkUser({ purpose: "link", stateUserId: "user-1", sessionUserId: "user-2" })
    ).toBeNull();
    expect(
      boundOAuthLinkUser({ purpose: "link", stateUserId: "user-1", sessionUserId: "user-1" })
    ).toBe("user-1");
  });

  it("never links an existing account by matching email", () => {
    expect(
      oauthRegistrationDecision({
        providerAccountExists: false,
        emailAccountExists: true,
        publicRegistrationEnabled: true,
        providerEmailVerified: true
      })
    ).toBe("email_conflict");
  });

  it("requires a positively verified provider email for registration", () => {
    expect(
      oauthRegistrationDecision({
        providerAccountExists: false,
        emailAccountExists: false,
        publicRegistrationEnabled: true,
        providerEmailVerified: false
      })
    ).toBe("unverified");
    expect(
      oauthRegistrationDecision({
        providerAccountExists: false,
        emailAccountExists: false,
        publicRegistrationEnabled: true,
        providerEmailVerified: true
      })
    ).toBe("create");
  });
});
