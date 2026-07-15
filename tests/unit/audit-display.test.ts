import { describe, expect, it } from "vitest";
import {
  describeTripActivity,
  formatTripActivityTime,
  type TripActivityEntry
} from "@/lib/audit-display";

function activity(overrides: Partial<TripActivityEntry>): TripActivityEntry {
  return {
    id: "activity-1",
    action: "trip.update",
    beforeJson: null,
    afterJson: null,
    createdAt: new Date("2026-07-14T15:30:00Z"),
    actor: { username: "Taylor", email: "taylor@example.com" },
    ...overrides
  };
}

describe("trip activity display", () => {
  it("describes expense activity with the actor and useful expense context", () => {
    const description = describeTripActivity(
      activity({
        action: "expense.create",
        afterJson: JSON.stringify({
          title: "Train tickets",
          amount: 84.5,
          category: "Transportation",
          status: "submitted"
        })
      })
    );

    expect(description).toEqual({
      summary: "Taylor added the expense “Train tickets”",
      detail: "$84.50 · Transportation · Submitted",
      kind: "add"
    });
  });

  it("uses the saved traveler name for additions and removals", () => {
    expect(
      describeTripActivity(
        activity({
          action: "participant.create",
          afterJson: JSON.stringify({ name: "Morgan" })
        })
      ).summary
    ).toBe("Taylor added traveler “Morgan”");

    expect(
      describeTripActivity(
        activity({
          action: "participant.delete",
          beforeJson: JSON.stringify({ name: "Morgan" })
        })
      ).summary
    ).toBe("Taylor removed traveler “Morgan”");
  });

  it("falls back safely for system, unknown, and malformed activity", () => {
    const description = describeTripActivity(
      activity({
        action: "custom.trip-event",
        afterJson: "not-json",
        actor: null
      })
    );

    expect(description).toEqual({
      summary: "SeddleUp recorded custom trip event",
      kind: "trip"
    });
  });

  it("formats the activity timestamp with both date and time", () => {
    const formatted = formatTripActivityTime(new Date("2026-07-14T15:30:00Z"));
    expect(formatted).toMatch(/Jul 14, 2026/);
    expect(formatted).toMatch(/\d{1,2}:30/);
  });
});
