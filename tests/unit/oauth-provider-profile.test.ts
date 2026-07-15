import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/oauth-providers", () => ({
  getProviderRuntimeConfig: vi.fn(async (provider: string) => ({
    definition: { userInfoUrl: `https://provider.example/${provider}/userinfo` }
  })),
  oauthCallbackUrl: vi.fn(() => "https://app.example.test/oauth/callback")
}));

import { providerProfile } from "@/app/api/auth/oauth/[provider]/callback/route";

describe("OAuth provider email verification", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("honors Google's explicit verification assertion", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          sub: "google-1",
          email: "user@example.test",
          email_verified: false
        })
      )
    );
    await expect(providerProfile("google", "redacted-access-token")).resolves.toMatchObject({
      email: "user@example.test",
      emailVerified: false
    });
  });

  it("uses Discord's explicit verified field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          id: "discord-1",
          email: "discord@example.test",
          verified: false,
          username: "traveler"
        })
      )
    );
    await expect(providerProfile("discord", "redacted-access-token")).resolves.toMatchObject({
      emailVerified: false
    });
  });

  it("requires GitHub's primary email to be verified", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ id: 42, login: "traveler" }))
      .mockResolvedValueOnce(
        Response.json([
          { email: "unverified@example.test", primary: true, verified: false },
          { email: "verified@example.test", primary: false, verified: true }
        ])
      );
    vi.stubGlobal("fetch", fetchMock);
    await expect(providerProfile("github", "redacted-access-token")).resolves.toMatchObject({
      email: null,
      emailVerified: false
    });
  });

  it("treats missing authoritative verification metadata as unverified", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          id: "facebook-1",
          email: "facebook@example.test",
          name: "Traveler"
        })
      )
    );
    await expect(providerProfile("facebook", "redacted-access-token")).resolves.toMatchObject({
      emailVerified: false
    });
  });
});
