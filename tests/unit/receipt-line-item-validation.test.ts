import { describe, expect, it } from "vitest";
import { receiptLineItemSchema } from "@/lib/validation";

describe("receipt line item validation", () => {
  const validItem = {
    name: "Shared dinner",
    quantity: "2",
    unitPrice: "5.00",
    totalPrice: "10.00",
    participantIds: ["participant-1"]
  };

  it("accepts bounded quantities, currency, and assignments", () => {
    expect(receiptLineItemSchema.safeParse(validItem).success).toBe(true);
  });

  it.each([
    { ...validItem, quantity: "0" },
    { ...validItem, quantity: "1.0001" },
    { ...validItem, totalPrice: "1.001" },
    { ...validItem, totalPrice: "0" },
    { ...validItem, participantIds: [] }
  ])("rejects invalid item data", (item) => {
    expect(receiptLineItemSchema.safeParse(item).success).toBe(false);
  });
});
