import { describe, expect, it } from "vitest";
import { calculateReceiptItemizedShares, planReceiptExpenseShares } from "@/lib/receipts/splitting";

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

  it("builds persisted shares in cents and reconciles tax, tip, and adjustments", () => {
    expect(
      planReceiptExpenseShares({
        splitMode: "itemized",
        participantIds: ["alice", "bob", "chris"],
        subtotal: "10.00",
        tax: "0.01",
        tip: "0.02",
        adjustments: "0.03",
        total: "10.06",
        lineItems: [
          {
            id: "shared",
            totalPrice: "10.00",
            assignedParticipantIds: ["alice", "bob", "chris"]
          }
        ]
      })
    ).toEqual({
      ok: true,
      totalCents: 1006,
      subtotalCents: 1000,
      shares: [
        { participantId: "alice", shareAmount: "3.36" },
        { participantId: "bob", shareAmount: "3.35" },
        { participantId: "chris", shareAmount: "3.35" }
      ]
    });
  });

  it("rejects empty assignments, cross-trip IDs, and unreconciled totals", () => {
    const base = {
      splitMode: "itemized" as const,
      participantIds: ["alice"],
      subtotal: "5.00",
      tax: "0.00",
      tip: "0.00",
      adjustments: "0.00",
      total: "5.00"
    };
    expect(
      planReceiptExpenseShares({
        ...base,
        lineItems: [{ id: "empty", totalPrice: "5.00", assignedParticipantIds: [] }]
      })
    ).toEqual({ ok: false, error: "assignments" });
    expect(
      planReceiptExpenseShares({
        ...base,
        lineItems: [{ id: "foreign", totalPrice: "5.00", assignedParticipantIds: ["bob"] }]
      })
    ).toEqual({ ok: false, error: "participants" });
    expect(
      planReceiptExpenseShares({
        ...base,
        total: "5.01",
        lineItems: [{ id: "mismatch", totalPrice: "5.00", assignedParticipantIds: ["alice"] }]
      })
    ).toEqual({ ok: false, error: "reconciliation" });
  });

  it("retains the existing simple split with deterministic remainder allocation", () => {
    expect(
      planReceiptExpenseShares({
        splitMode: "simple",
        participantIds: ["alice", "bob", "chris"],
        lineItems: [],
        total: "10.00"
      })
    ).toMatchObject({
      ok: true,
      shares: [
        { participantId: "alice", shareAmount: "3.34" },
        { participantId: "bob", shareAmount: "3.33" },
        { participantId: "chris", shareAmount: "3.33" }
      ]
    });
    expect(
      planReceiptExpenseShares({
        splitMode: "simple",
        participantIds: ["alice"],
        lineItems: [],
        subtotal: "9.00",
        tax: "1.00",
        total: "11.00"
      })
    ).toEqual({ ok: false, error: "reconciliation" });
  });
});
