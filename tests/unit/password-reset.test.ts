import * as bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import {
  completePasswordResetWithStore,
  generatePasswordResetToken,
  hashPasswordResetToken,
  isPasswordResetTokenExpired,
  validatePasswordResetRecord,
  type PasswordResetRecord,
  type PasswordResetStore
} from "@/lib/password-reset";

function record(overrides: Partial<PasswordResetRecord> = {}): PasswordResetRecord {
  return {
    id: "reset-token-1",
    tokenHash: hashPasswordResetToken("valid-token"),
    expiresAt: new Date("2026-05-27T13:00:00Z"),
    usedAt: null,
    userId: "user-1",
    ...overrides
  };
}

function fakeStore(initialRecord: PasswordResetRecord | null, consume = true) {
  const state = {
    passwordHash: "",
    usedAt: null as Date | null,
    tokenId: "",
    userId: ""
  };

  const store: PasswordResetStore = {
    async findByTokenHash(tokenHash) {
      if (!initialRecord || initialRecord.tokenHash !== tokenHash) {
        return null;
      }
      return initialRecord;
    },
    async updatePasswordAndMarkTokenUsed(input) {
      if (!consume) return false;
      state.passwordHash = input.passwordHash;
      state.usedAt = input.usedAt;
      state.tokenId = input.tokenId;
      state.userId = input.userId;
      return true;
    }
  };

  return { store, state };
}

describe("password reset tokens", () => {
  it("generates secure opaque tokens and hashes them for storage", () => {
    const token = generatePasswordResetToken();
    const tokenHash = hashPasswordResetToken(token);

    expect(token).toHaveLength(43);
    expect(tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(tokenHash).not.toBe(token);
  });

  it("detects expired tokens", () => {
    const expired = record({ expiresAt: new Date("2026-05-27T12:00:00Z") });

    expect(isPasswordResetTokenExpired(expired, new Date("2026-05-27T12:00:01Z"))).toBe(true);
    expect(validatePasswordResetRecord(expired, new Date("2026-05-27T12:00:01Z"))).toBe(false);
  });

  it("rejects invalid or already used tokens", () => {
    expect(validatePasswordResetRecord(null)).toBe(false);
    expect(validatePasswordResetRecord(record({ usedAt: new Date("2026-05-27T12:05:00Z") }))).toBe(
      false
    );
  });

  it("updates the password and invalidates the token after a successful reset", async () => {
    const { store, state } = fakeStore(record());
    const success = await completePasswordResetWithStore(
      "valid-token",
      "NewPass123",
      store,
      new Date("2026-05-27T12:15:00Z")
    );

    expect(success).toBe(true);
    expect(state.userId).toBe("user-1");
    expect(state.tokenId).toBe("reset-token-1");
    expect(state.usedAt?.toISOString()).toBe("2026-05-27T12:15:00.000Z");
    await expect(bcrypt.compare("NewPass123", state.passwordHash)).resolves.toBe(true);
  });

  it("does not update the password for an invalid token", async () => {
    const { store, state } = fakeStore(record());
    const success = await completePasswordResetWithStore(
      "wrong-token",
      "NewPass123",
      store,
      new Date("2026-05-27T12:15:00Z")
    );

    expect(success).toBe(false);
    expect(state.passwordHash).toBe("");
    expect(state.usedAt).toBeNull();
  });

  it("fails generically when another request consumes the token first", async () => {
    const { store, state } = fakeStore(record(), false);
    const success = await completePasswordResetWithStore(
      "valid-token",
      "NewPass123",
      store,
      new Date("2026-05-27T12:15:00Z")
    );

    expect(success).toBe(false);
    expect(state.passwordHash).toBe("");
    expect(state.usedAt).toBeNull();
  });
});
