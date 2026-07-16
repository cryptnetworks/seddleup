import { describe, expect, it } from "vitest";
import { calculateReceiptItemizedShares } from "@/lib/receipts/splitting";

describe("itemized receipt splitting", () => {
  it("excludes participants from individual items and allocates tax/tip proportionally", () => {
    const shares = calculateReceiptItemizedShares({
      participantIds: ["alice", "bob", "chris"],
      tax: 3,
      tip: 6,
      lineItems: [
        {
          id: "pizza",
          totalPrice: 30,
          assignedParticipantIds: ["alice", "bob", "chris"],
          excludedParticipantIds: ["chris"]
        },
        {
          id: "salad",
          totalPrice: 15,
          assignedParticipantIds: ["alice", "bob", "chris"],
          excludedParticipantIds: ["bob"]
        }
      ]
    });

    expect(shares).toEqual({
      alice: 27,
      bob: 18,
      chris: 9
    });
  });

  it("reconciles fractional cents deterministically without losing money", () => {
    const shares = calculateReceiptItemizedShares({
      participantIds: ["alice", "bob", "chris"],
      tax: 0.01,
      lineItems: [
        {
          id: "shared",
          totalPrice: 10,
          assignedParticipantIds: ["alice", "bob", "chris"]
        }
      ]
    });

    expect(shares).toEqual({ alice: 3.34, bob: 3.34, chris: 3.33 });
    expect(Object.values(shares).reduce((sum, value) => sum + value, 0)).toBeCloseTo(10.01, 2);
  });

  it("defines an empty assignment as unallocated", () => {
    expect(
      calculateReceiptItemizedShares({
        participantIds: ["alice"],
        lineItems: [{ id: "unassigned", totalPrice: 5, assignedParticipantIds: [] }]
      })
    ).toEqual({ alice: 0 });
  });
});
