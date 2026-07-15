import { describe, expect, it } from "vitest";
import {
  hasParticipantFinancialDependencies,
  participantDependencySummary
} from "@/lib/participant-integrity";

describe("participant financial dependency policy", () => {
  it("allows deletion only when every financial dependency count is zero", () => {
    expect(
      hasParticipantFinancialDependencies({
        expensesPaid: 0,
        expenseShares: 0,
        receiptAssignments: 0
      })
    ).toBe(false);
    expect(
      hasParticipantFinancialDependencies({
        expensesPaid: 0,
        expenseShares: 1,
        receiptAssignments: 0
      })
    ).toBe(true);
  });

  it("describes only the records that block deletion", () => {
    expect(
      participantDependencySummary({
        expensesPaid: 1,
        expenseShares: 2,
        receiptAssignments: 1
      })
    ).toBe("1 paid expense, 2 expense shares, 1 receipt assignment");
  });
});
