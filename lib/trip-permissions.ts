export const tripRoles = ["owner", "admin", "member", "viewer"] as const;
export type TripRole = (typeof tripRoles)[number];

export const expenseStatuses = ["draft", "submitted", "approved", "disputed", "settled"] as const;
export type ExpenseStatus = (typeof expenseStatuses)[number];

export type TripMembership = {
  role: string;
  userId: string;
};

export type ExpensePermissionTarget = {
  createdByUserId: string | null;
  status: string;
};

export type TripPaymentPermissionTarget = {
  confirmedByUserId: string | null;
  recipientParticipantUserId: string | null;
};

export type TripPaymentConfirmationTarget = {
  senderParticipantId: string;
  recipientParticipantId: string;
  recipientParticipantUserId: string | null;
};

export function normalizeTripRole(role?: string | null): TripRole {
  return tripRoles.includes(role as TripRole) ? (role as TripRole) : "viewer";
}

export function normalizeExpenseStatus(status?: string | null): ExpenseStatus {
  return expenseStatuses.includes(status as ExpenseStatus)
    ? (status as ExpenseStatus)
    : "submitted";
}

export function isTripManager(role?: string | null) {
  const normalized = normalizeTripRole(role);
  return normalized === "owner" || normalized === "admin";
}

export function canCreateTripExpense(role?: string | null) {
  const normalized = normalizeTripRole(role);
  return normalized === "owner" || normalized === "admin" || normalized === "member";
}

export function canConfirmTripPayment(
  role: string | null | undefined,
  userId: string,
  target: TripPaymentConfirmationTarget
) {
  const normalized = normalizeTripRole(role);
  return (
    normalized !== "viewer" &&
    target.senderParticipantId !== target.recipientParticipantId &&
    target.recipientParticipantUserId === userId
  );
}

export function canEditConfirmedTripPayment(
  role: string | null | undefined,
  userId: string,
  payment: TripPaymentPermissionTarget
) {
  return (
    normalizeTripRole(role) !== "viewer" &&
    payment.confirmedByUserId === userId &&
    payment.recipientParticipantUserId === userId
  );
}

export function canDeleteConfirmedTripPayment(
  role: string | null | undefined,
  userId: string,
  payment: TripPaymentPermissionTarget
) {
  return canEditConfirmedTripPayment(role, userId, payment);
}

export function canViewDraftExpense(
  role: string | null | undefined,
  userId: string,
  createdByUserId?: string | null
) {
  return isTripManager(role) || createdByUserId === userId;
}

export function canViewExpense(
  role: string | null | undefined,
  userId: string,
  expense: ExpensePermissionTarget
) {
  const status = normalizeExpenseStatus(expense.status);
  return status !== "draft" || canViewDraftExpense(role, userId, expense.createdByUserId);
}

export function canEditExpense(
  role: string | null | undefined,
  userId: string,
  expense: ExpensePermissionTarget
) {
  const status = normalizeExpenseStatus(expense.status);
  if (status === "settled") return false;
  return isTripManager(role) || expense.createdByUserId === userId;
}

export function canDeleteExpense(
  role: string | null | undefined,
  userId: string,
  expense: ExpensePermissionTarget
) {
  return canEditExpense(role, userId, expense);
}

export function canIncludeExpenseInBalances(status?: string | null) {
  return normalizeExpenseStatus(status) !== "draft";
}

export function allowedExpenseStatusesForRole(role?: string | null): ExpenseStatus[] {
  if (isTripManager(role)) {
    return ["draft", "submitted", "approved", "disputed", "settled"];
  }
  return ["draft", "submitted", "disputed"];
}

export function coerceExpenseStatusForRole(status: string | undefined, role?: string | null) {
  const normalized = normalizeExpenseStatus(status);
  const allowed = allowedExpenseStatusesForRole(role);
  return allowed.includes(normalized) ? normalized : "submitted";
}
