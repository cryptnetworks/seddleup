import { describe, expect, it } from "vitest";
import { tripPaymentConfirmationSchema, tripPaymentEditSchema } from "@/lib/validation";

const valid = {
  senderParticipantId: "participant-a",
  recipientParticipantId: "participant-b",
  amount: "20.00",
  date: "2026-07-15",
  note: "Dinner reimbursement"
};

describe("trip payment validation", () => {
  it("accepts a positive USD amount with two decimal places", () => {
    expect(tripPaymentConfirmationSchema.parse(valid).amount).toBe(20);
    expect(tripPaymentConfirmationSchema.parse({ ...valid, amount: "20,25" }).amount).toBe(20.25);
  });

  it.each(["", "0", "-1", "NaN", "Infinity", "1.001", "1000000.01"])(
    "rejects invalid amount %s",
    (amount) => {
      expect(tripPaymentConfirmationSchema.safeParse({ ...valid, amount }).success).toBe(false);
    }
  );

  it("rejects the same sender and recipient", () => {
    expect(
      tripPaymentConfirmationSchema.safeParse({
        ...valid,
        recipientParticipantId: valid.senderParticipantId
      }).success
    ).toBe(false);
  });

  it("rejects invalid dates and oversized notes", () => {
    expect(tripPaymentConfirmationSchema.safeParse({ ...valid, date: "tomorrow" }).success).toBe(
      false
    );
    expect(tripPaymentConfirmationSchema.safeParse({ ...valid, date: "2026-02-30" }).success).toBe(
      false
    );
    expect(
      tripPaymentConfirmationSchema.safeParse({ ...valid, note: "x".repeat(501) }).success
    ).toBe(false);
  });

  it("limits edits to payment date and note", () => {
    expect(tripPaymentEditSchema.safeParse({ date: valid.date, note: valid.note }).success).toBe(
      true
    );
    expect(tripPaymentEditSchema.safeParse({ date: "2026-02-30", note: valid.note }).success).toBe(
      false
    );
    expect(
      tripPaymentEditSchema.safeParse({ date: valid.date, note: "x".repeat(501) }).success
    ).toBe(false);
  });
});
