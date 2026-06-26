import { describe, expect, it } from "vitest";
import { encryptSecret } from "@/lib/secret-encryption";
import { pendingAuthenticatorSetup } from "@/lib/two-factor";

describe("pending authenticator setup", () => {
  it("reconstructs setup details from encrypted server-side state", () => {
    const secret = "JBSWY3DPEHPK3PXP";
    const setup = pendingAuthenticatorSetup({
      email: "mfa-user@seddleup.test",
      authenticatorEnabled: false,
      authenticatorSecretEncrypted: encryptSecret(secret)
    });

    expect(setup).toEqual({
      secret,
      uri: expect.stringContaining("otpauth://totp/SeddleUp%3Amfa-user%40seddleup.test")
    });
    expect(setup?.uri).toContain(`secret=${secret}`);
  });

  it("does not expose setup details after authenticator verification is enabled", () => {
    const setup = pendingAuthenticatorSetup({
      email: "mfa-user@seddleup.test",
      authenticatorEnabled: true,
      authenticatorSecretEncrypted: encryptSecret("JBSWY3DPEHPK3PXP")
    });

    expect(setup).toBeNull();
  });
});
