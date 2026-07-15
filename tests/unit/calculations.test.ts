import { describe, expect, it } from "vitest";
import {
  calculateBalances,
  calculateEqualShares,
  generateSettlementSuggestions
} from "@/lib/calculations";
import { testExpense, testParticipant, testTripPayment } from "@/tests/fixtures/triptally";

describe("calculateEqualShares", () => {
  it("splits cents without losing or creating money", () => {
    const shares = calculateEqualShares(100, 3);

    expect(shares).toEqual([33.34, 33.33, 33.33]);
    expect(shares.reduce((sum, share) => sum + share, 0)).toBeCloseTo(100, 2);
  });

  it("returns no shares for an empty participant set", () => {
    expect(calculateEqualShares(42, 0)).toEqual([]);
  });
});

describe("calculateBalances", () => {
  it("calculates paid, owed, net, and settlements", () => {
    const alice = testParticipant("alice", "Alice");
    const bob = testParticipant("bob", "Bob");
    const claire = testParticipant("claire", "Claire");

    const result = calculateBalances(
      [alice, bob, claire],
      [
        testExpense({
          id: "rental",
          amount: 90,
          payerId: alice.id,
          shares: [
            { participantId: alice.id, shareAmount: 30 },
            { participantId: bob.id, shareAmount: 30 },
            { participantId: claire.id, shareAmount: 30 }
          ]
        }),
        testExpense({
          id: "dinner",
          amount: 60,
          payerId: bob.id,
          shares: [
            { participantId: alice.id, shareAmount: 30 },
            { participantId: bob.id, shareAmount: 30 }
          ]
        })
      ]
    );

    expect(result.balances).toEqual([
      expect.objectContaining({ participant: alice, paid: 90, owed: 60, net: 30 }),
      expect.objectContaining({ participant: bob, paid: 60, owed: 60, net: 0 }),
      expect.objectContaining({ participant: claire, paid: 0, owed: 30, net: -30 })
    ]);
    expect(result.settlements).toEqual([
      expect.objectContaining({
        debtorName: "Claire",
        creditorName: "Alice",
        amount: 30,
        label: "Claire owes Alice $30.00"
      })
    ]);
  });

  it("falls back to equal split when an expense has no stored shares", () => {
    const alice = testParticipant("alice", "Alice");
    const bob = testParticipant("bob", "Bob");

    const result = calculateBalances(
      [alice, bob],
      [testExpense({ id: "taxi", amount: 25, payerId: alice.id, shares: [] })]
    );

    expect(result.balances).toEqual([
      expect.objectContaining({ participant: alice, paid: 25, owed: 12.5, net: 12.5 }),
      expect.objectContaining({ participant: bob, paid: 0, owed: 12.5, net: -12.5 })
    ]);
  });
});

describe("generateSettlementSuggestions", () => {
  it("minimizes multi-person debt settlement", () => {
    const alice = testParticipant("alice", "Alice");
    const bob = testParticipant("bob", "Bob");
    const claire = testParticipant("claire", "Claire");
    const drew = testParticipant("drew", "Drew");

    const settlements = generateSettlementSuggestions([
      { participant: alice, paid: 0, owed: 0, sent: 0, received: 0, net: 50 },
      { participant: bob, paid: 0, owed: 0, sent: 0, received: 0, net: 20 },
      { participant: claire, paid: 0, owed: 0, sent: 0, received: 0, net: -40 },
      { participant: drew, paid: 0, owed: 0, sent: 0, received: 0, net: -30 }
    ]);

    expect(settlements.map((settlement) => settlement.label)).toEqual([
      "Claire owes Alice $40.00",
      "Drew owes Alice $10.00",
      "Drew owes Bob $20.00"
    ]);
  });
});

describe("trip payment balance adjustments", () => {
  const alice = testParticipant("alice", "Alice");
  const bob = testParticipant("bob", "Bob");
  const baseExpenses = [
    testExpense({
      id: "hotel",
      amount: 100,
      payerId: alice.id,
      shares: [
        { participantId: alice.id, shareAmount: 50 },
        { participantId: bob.id, shareAmount: 50 }
      ]
    })
  ];

  it("preserves existing balances when there are no payments", () => {
    const result = calculateBalances([alice, bob], baseExpenses);
    expect(result.balances).toEqual([
      expect.objectContaining({ paid: 100, owed: 50, sent: 0, received: 0, net: 50 }),
      expect.objectContaining({ paid: 0, owed: 50, sent: 0, received: 0, net: -50 })
    ]);
  });

  it("applies partial and full settlement payments", () => {
    const partial = calculateBalances([alice, bob], baseExpenses, [
      testTripPayment(bob.id, alice.id, 20)
    ]);
    expect(partial.balances).toEqual([
      expect.objectContaining({ received: 20, net: 30 }),
      expect.objectContaining({ sent: 20, net: -30 })
    ]);
    expect(partial.settlements[0]).toEqual(expect.objectContaining({ amount: 30 }));

    const full = calculateBalances([alice, bob], baseExpenses, [
      testTripPayment(bob.id, alice.id, 50)
    ]);
    expect(full.balances.map((balance) => balance.net)).toEqual([0, 0]);
    expect(full.settlements).toEqual([]);
  });

  it("combines multiple payments and rounds currency totals", () => {
    const result = calculateBalances([alice, bob], baseExpenses, [
      testTripPayment(bob.id, alice.id, 10.1),
      testTripPayment(bob.id, alice.id, 20.2)
    ]);
    expect(result.balances).toEqual([
      expect.objectContaining({ received: 30.3, net: 19.7 }),
      expect.objectContaining({ sent: 30.3, net: -19.7 })
    ]);
  });

  it("handles overpayment by reversing the remaining obligation", () => {
    const result = calculateBalances([alice, bob], baseExpenses, [
      testTripPayment(bob.id, alice.id, 70)
    ]);
    expect(result.balances.map((balance) => balance.net)).toEqual([-20, 20]);
    expect(result.settlements).toEqual([
      expect.objectContaining({ debtorId: alice.id, creditorId: bob.id, amount: 20 })
    ]);
  });

  it("restores the prior balance when a payment is omitted after deletion", () => {
    const withPayment = calculateBalances([alice, bob], baseExpenses, [
      testTripPayment(bob.id, alice.id, 20)
    ]);
    const afterDeletion = calculateBalances([alice, bob], baseExpenses, []);
    expect(withPayment.balances.map((balance) => balance.net)).toEqual([30, -30]);
    expect(afterDeletion.balances.map((balance) => balance.net)).toEqual([50, -50]);
  });

  it("rejects invalid participant combinations", () => {
    expect(() =>
      calculateBalances([alice, bob], baseExpenses, [testTripPayment(alice.id, alice.id, 10)])
    ).toThrow(/must differ/);
    expect(() =>
      calculateBalances([alice, bob], baseExpenses, [testTripPayment("other-trip", alice.id, 10)])
    ).toThrow(/belong/);
  });
});
