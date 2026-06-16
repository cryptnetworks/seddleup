import crypto from "crypto";

const TEST_TOKEN_DIGEST_SECRET = "seddleup-test-token-digest-secret";
const TOKEN_DIGEST_HEX_LENGTH = 64;

function tokenDigestSecret() {
  const secret = process.env.TOKEN_DIGEST_SECRET;
  if (secret) return secret;

  if (process.env.NODE_ENV === "test") {
    return TEST_TOKEN_DIGEST_SECRET;
  }

  throw new Error("TOKEN_DIGEST_SECRET is required for token digests.");
}

export function digestLookupToken(opaqueRandomValue: string) {
  // This stores high-entropy random one-time lookup tokens as keyed HMAC digests.
  // User passwords still use bcrypt; these values are not user-memorable secrets.
  return crypto.createHmac("sha256", tokenDigestSecret()).update(opaqueRandomValue).digest("hex"); // codeql[js/insufficient-password-hash]
}

export function timingSafeEqualTokenDigest(opaqueRandomValue: string, expectedDigest: string) {
  if (!/^[a-f0-9]{64}$/i.test(expectedDigest)) return false;

  const actual = Buffer.from(digestLookupToken(opaqueRandomValue), "hex");
  const expected = Buffer.from(expectedDigest, "hex");

  if (actual.length !== TOKEN_DIGEST_HEX_LENGTH / 2 || expected.length !== actual.length) {
    return false;
  }

  return crypto.timingSafeEqual(actual, expected);
}
