import { describe, expect, it } from "vitest";
import {
  allowedExpenseStatusesForRole,
  canConfirmTripPayment,
  canDeleteExpense,
  canDeleteConfirmedTripPayment,
  canEditExpense,
  canEditConfirmedTripPayment,
  canIncludeExpenseInBalances,
  canViewExpense,
  coerceExpenseStatusForRole,
  isTripManager
} from "@/lib/trip-permissions";

describe("trip permissions", () => {
  it("allows only managers to manage trip settings and all expenses", () => {
    expect(isTripManager("owner")).toBe(true);
    expect(isTripManager("admin")).toBe(true);
    expect(isTripManager("member")).toBe(false);
    expect(isTripManager("viewer")).toBe(false);
  });

  it("allows members to edit their own unsettled expenses only", () => {
    expect(
      canEditExpense("member", "user-1", { createdByUserId: "user-1", status: "submitted" })
    ).toBe(true);
    expect(
      canEditExpense("member", "user-1", { createdByUserId: "user-2", status: "submitted" })
    ).toBe(false);
    expect(
      canDeleteExpense("member", "user-1", { createdByUserId: "user-1", status: "settled" })
    ).toBe(false);
  });

  it("keeps draft expenses private to creators and managers", () => {
    const draft = { createdByUserId: "creator", status: "draft" };

    expect(canViewExpense("member", "creator", draft)).toBe(true);
    expect(canViewExpense("member", "other", draft)).toBe(false);
    expect(canViewExpense("admin", "other", draft)).toBe(true);
  });

  it("excludes drafts from balance calculations", () => {
    expect(canIncludeExpenseInBalances("draft")).toBe(false);
    expect(canIncludeExpenseInBalances("submitted")).toBe(true);
    expect(canIncludeExpenseInBalances("disputed")).toBe(true);
    expect(canIncludeExpenseInBalances("settled")).toBe(true);
  });

  it("limits non-manager status changes", () => {
    expect(allowedExpenseStatusesForRole("member")).toEqual(["draft", "submitted", "disputed"]);
    expect(coerceExpenseStatusForRole("settled", "member")).toBe("submitted");
    expect(coerceExpenseStatusForRole("settled", "owner")).toBe("settled");
  });

  it("allows only the linked non-viewer creditor to confirm settlement payments", () => {
    const creditorTarget = {
      senderParticipantId: "debtor-participant",
      recipientParticipantId: "creditor-participant",
      recipientParticipantUserId: "creditor"
    };
    expect(canConfirmTripPayment("owner", "creditor", creditorTarget)).toBe(true);
    expect(canConfirmTripPayment("admin", "manager", creditorTarget)).toBe(false);
    expect(canConfirmTripPayment("member", "creditor", creditorTarget)).toBe(true);
    expect(canConfirmTripPayment("member", "debtor", creditorTarget)).toBe(false);
    expect(canConfirmTripPayment("viewer", "creditor", creditorTarget)).toBe(false);
    expect(
      canConfirmTripPayment("member", "creditor", {
        ...creditorTarget,
        recipientParticipantUserId: null
      })
    ).toBe(false);
    expect(
      canConfirmTripPayment("member", "creditor", {
        ...creditorTarget,
        senderParticipantId: creditorTarget.recipientParticipantId
      })
    ).toBe(false);

    const ownPayment = {
      confirmedByUserId: "creditor",
      recipientParticipantUserId: "creditor"
    };
    expect(canEditConfirmedTripPayment("member", "creditor", ownPayment)).toBe(true);
    expect(canDeleteConfirmedTripPayment("member", "creditor", ownPayment)).toBe(true);
    expect(
      canEditConfirmedTripPayment("member", "creditor", {
        ...ownPayment,
        confirmedByUserId: "other"
      })
    ).toBe(false);
    expect(canDeleteConfirmedTripPayment("viewer", "creditor", ownPayment)).toBe(false);
    expect(canEditConfirmedTripPayment("admin", "admin", ownPayment)).toBe(false);
  });
});
