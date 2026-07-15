import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimitStoreForTesting } from "@/lib/rate-limit";
import {
  checkTripShareLookupRateLimit,
  generateTripShareToken,
  hashTripShareToken,
  isValidTripShareTokenShape,
  participantShareLabels,
  tripShareExpiresAt,
  tripShareStatus
} from "@/lib/trip-sharing";

describe("trip sharing security primitives", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-14T12:00:00Z"));
    resetRateLimitStoreForTesting();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetRateLimitStoreForTesting();
  });

  it("generates a 256-bit URL-safe token and stores only a keyed digest", () => {
    const token = generateTripShareToken();
    const digest = hashTripShareToken(token);

    expect(token).toHaveLength(43);
    expect(isValidTripShareTokenShape(token)).toBe(true);
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(digest).not.toContain(token);
  });

  it("supports optional expiration and uniform lifecycle states", () => {
    const now = new Date();
    expect(tripShareExpiresAt("30", now)?.toISOString()).toBe("2026-08-13T12:00:00.000Z");
    expect(tripShareExpiresAt("never", now)).toBeNull();
    expect(tripShareStatus({ expiresAt: null, revokedAt: null }, now)).toBe("active");
    expect(tripShareStatus({ expiresAt: new Date(now.getTime() - 1), revokedAt: null }, now)).toBe(
      "expired"
    );
    expect(tripShareStatus({ expiresAt: null, revokedAt: now }, now)).toBe("revoked");
  });

  it("uses anonymized participant labels by default and supports manager-selected modes", () => {
    const participants = [
      { id: "one", name: "Alice Example" },
      { id: "two", name: "Bob Traveler" }
    ];

    expect(Array.from(participantShareLabels(participants, "anonymized").values())).toEqual([
      "Traveler 1",
      "Traveler 2"
    ]);
    expect(Array.from(participantShareLabels(participants, "initials").values())).toEqual([
      "AE",
      "BT"
    ]);
    expect(Array.from(participantShareLabels(participants, "first_name").values())).toEqual([
      "Alice",
      "Bob"
    ]);
  });

  it("limits repeated anonymous lookups without using the bearer token", () => {
    for (let request = 0; request < 60; request += 1) {
      expect(checkTripShareLookupRateLimit("hashed-requester").allowed).toBe(true);
    }
    expect(checkTripShareLookupRateLimit("hashed-requester").allowed).toBe(false);
    expect(checkTripShareLookupRateLimit("different-requester").allowed).toBe(true);
  });
});
