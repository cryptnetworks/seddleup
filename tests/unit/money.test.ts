import { describe, expect, it } from "vitest";
import { equalShareCents, parseUsdMoney, usdDecimalFromCents } from "@/lib/money";
import { expenseSchema, optionalUsdMoneySchema, receiptReviewSchema } from "@/lib/validation";

function expenseInput(amount: string) {
  return {
    title: "Dinner",
    amount,
    category: "Food",
    payerId: "participant-1",
    date: "2026-07-15",
    status: "submitted",
    notes: "",
    sharedParticipantIds: ["participant-1"]
  };
}

describe("USD input policy", () => {
  it.each([
    ["0.01", 1, "0.01"],
    ["1", 100, "1.00"],
    ["1.2", 120, "1.20"],
    ["9,75", 975, "9.75"],
    ["1000000.00", 100_000_000, "1000000.00"],
    [" 12.50 ", 1250, "12.50"]
  ])("parses %s without floating-point conversion", (input, cents, decimal) => {
    expect(parseUsdMoney(input)).toEqual({ ok: true, value: { cents, decimal } });
  });

  it.each([
    ["", "required"],
    ["0", "positive"],
    ["-1.00", "positive"],
    ["10.001", "precision"],
    ["1e2", "format"],
    ["NaN", "format"],
    ["Infinity", "format"],
    ["1,000.00", "format"],
    ["1.000,00", "format"],
    ["1000000.01", "maximum"]
  ])("rejects %s as %s", (input, error) => {
    expect(parseUsdMoney(input)).toMatchObject({ ok: false, error });
  });

  it("allows zero only for optional receipt totals", () => {
    expect(parseUsdMoney("0", { allowZero: true })).toEqual({
      ok: true,
      value: { cents: 0, decimal: "0.00" }
    });
    expect(optionalUsdMoneySchema.parse("")).toBeNull();
    expect(optionalUsdMoneySchema.parse("0")).toEqual({ cents: 0, decimal: "0.00" });
  });

  it("creates exact shares that reconcile to the submitted cents", () => {
    const shares = equalShareCents(1001, 3);
    expect(shares).toEqual([334, 334, 333]);
    expect(shares.reduce((sum, share) => sum + share, 0)).toBe(1001);
    expect(shares.map(usdDecimalFromCents)).toEqual(["3.34", "3.34", "3.33"]);
  });
});

describe("server monetary schemas", () => {
  it("canonicalizes valid expense amounts and rejects manipulated precision", () => {
    expect(expenseSchema.parse(expenseInput("10,25")).amount).toEqual({
      cents: 1025,
      decimal: "10.25"
    });
    expect(expenseSchema.safeParse(expenseInput("10.001")).success).toBe(false);
  });

  it("validates every optional receipt total with the same policy", () => {
    const valid = receiptReviewSchema.parse({
      merchant: "Market",
      receiptDate: "",
      subtotal: "10,00",
      tax: "0.80",
      tip: "",
      total: "10.80",
      status: "ready",
      splitMode: "simple"
    });
    expect(valid).toMatchObject({
      subtotal: { decimal: "10.00" },
      tax: { decimal: "0.80" },
      tip: null,
      total: { decimal: "10.80" }
    });

    for (const input of ["-1", "10.001", "NaN", "Infinity", "1e2", "1000000.01"]) {
      expect(
        receiptReviewSchema.safeParse({
          merchant: "Market",
          receiptDate: "",
          subtotal: input,
          tax: "",
          tip: "",
          total: "",
          status: "needs_review",
          splitMode: "simple"
        }).success
      ).toBe(false);
    }
  });
});
