import { roundCurrency } from "@/lib/calculations";
import { equalShareCents, parseUsdMoney, usdDecimalFromCents } from "@/lib/money";

export type ReceiptSplitLineItem = {
  id: string;
  totalPrice: number;
  assignedParticipantIds: string[];
  excludedParticipantIds?: string[];
};

export type PersistedReceiptSplitLineItem = {
  id: string;
  totalPrice: string;
  assignedParticipantIds: string[];
};

export type ReceiptExpenseSharePlan =
  | {
      ok: true;
      totalCents: number;
      subtotalCents: number;
      shares: { participantId: string; shareAmount: string }[];
    }
  | { ok: false; error: "amount" | "assignments" | "participants" | "reconciliation" };

function parseCents(value: string | null | undefined, allowZero = true) {
  const parsed = parseUsdMoney(value || "0", { allowZero });
  return parsed.ok ? parsed.value.cents : null;
}

/**
 * Produces the authoritative expense shares from persisted receipt values.
 * Inputs are decimal strings so persisted money never crosses a floating-point boundary.
 */
export function planReceiptExpenseShares({
  splitMode,
  lineItems,
  participantIds,
  subtotal,
  tax,
  tip,
  adjustments,
  total
}: {
  splitMode: "simple" | "itemized";
  lineItems: PersistedReceiptSplitLineItem[];
  participantIds: string[];
  subtotal?: string | null;
  tax?: string | null;
  tip?: string | null;
  adjustments?: string | null;
  total: string;
}): ReceiptExpenseSharePlan {
  const uniqueParticipantIds = [...new Set(participantIds)];
  if (uniqueParticipantIds.length === 0 || uniqueParticipantIds.length !== participantIds.length) {
    return { ok: false, error: "participants" };
  }

  const totalCents = parseCents(total, false);
  const taxCents = parseCents(tax);
  const tipCents = parseCents(tip);
  const adjustmentCents = parseCents(adjustments);
  if (totalCents === null || taxCents === null || tipCents === null || adjustmentCents === null) {
    return { ok: false, error: "amount" };
  }

  if (splitMode === "simple") {
    const derivedSubtotalCents = totalCents - taxCents - tipCents - adjustmentCents;
    const reviewedSubtotalCents = subtotal ? parseCents(subtotal) : derivedSubtotalCents;
    if (
      derivedSubtotalCents < 0 ||
      reviewedSubtotalCents === null ||
      reviewedSubtotalCents !== derivedSubtotalCents
    ) {
      return { ok: false, error: "reconciliation" };
    }
    const allocations = equalShareCents(totalCents, uniqueParticipantIds.length);
    return {
      ok: true,
      totalCents,
      subtotalCents: derivedSubtotalCents,
      shares: uniqueParticipantIds.map((participantId, index) => ({
        participantId,
        shareAmount: usdDecimalFromCents(allocations[index])
      }))
    };
  }

  if (lineItems.length === 0) return { ok: false, error: "assignments" };
  const participantSet = new Set(uniqueParticipantIds);
  const itemCents: number[] = [];
  for (const item of lineItems) {
    const cents = parseCents(item.totalPrice, false);
    if (cents === null) return { ok: false, error: "amount" };
    const assigned = [...new Set(item.assignedParticipantIds)];
    if (assigned.length === 0) return { ok: false, error: "assignments" };
    if (assigned.some((participantId) => !participantSet.has(participantId))) {
      return { ok: false, error: "participants" };
    }
    itemCents.push(cents);
  }

  const itemSubtotalCents = itemCents.reduce((sum, cents) => sum + cents, 0);
  const reviewedSubtotalCents = subtotal ? parseCents(subtotal) : itemSubtotalCents;
  if (reviewedSubtotalCents === null) return { ok: false, error: "amount" };
  if (
    reviewedSubtotalCents !== itemSubtotalCents ||
    itemSubtotalCents + taxCents + tipCents + adjustmentCents !== totalCents
  ) {
    return { ok: false, error: "reconciliation" };
  }

  const shareCents = new Map(uniqueParticipantIds.map((participantId) => [participantId, 0]));
  const additions = taxCents + tipCents + adjustmentCents;
  const additionAllocations = itemCents.map((cents) =>
    Number((BigInt(cents) * BigInt(additions)) / BigInt(itemSubtotalCents))
  );
  let additionRemainder = additions - additionAllocations.reduce((sum, cents) => sum + cents, 0);
  for (let index = 0; additionRemainder > 0; index = (index + 1) % additionAllocations.length) {
    additionAllocations[index] += 1;
    additionRemainder -= 1;
  }

  lineItems.forEach((item, itemIndex) => {
    const assigned = [...new Set(item.assignedParticipantIds)];
    const allocations = equalShareCents(
      itemCents[itemIndex] + additionAllocations[itemIndex],
      assigned.length
    );
    assigned.forEach((participantId, participantIndex) => {
      shareCents.set(
        participantId,
        (shareCents.get(participantId) || 0) + allocations[participantIndex]
      );
    });
  });

  return {
    ok: true,
    totalCents,
    subtotalCents: itemSubtotalCents,
    shares: uniqueParticipantIds.map((participantId) => ({
      participantId,
      shareAmount: usdDecimalFromCents(shareCents.get(participantId) || 0)
    }))
  };
}

export function calculateReceiptItemizedShares({
  lineItems,
  participantIds,
  tax = 0,
  tip = 0,
  adjustments = 0
}: {
  lineItems: ReceiptSplitLineItem[];
  participantIds: string[];
  tax?: number;
  tip?: number;
  adjustments?: number;
}) {
  const sharesInCents = new Map(participantIds.map((participantId) => [participantId, 0]));
  const itemCents = lineItems.map((item) => Math.round(item.totalPrice * 100));
  const itemSubtotalCents = itemCents.reduce((sum, value) => sum + value, 0);
  const serviceCents = Math.round((tax + tip + adjustments) * 100);
  const serviceAllocations = itemCents.map((value) =>
    itemSubtotalCents > 0 ? Math.floor((value * serviceCents) / itemSubtotalCents) : 0
  );
  let serviceRemainder = serviceCents - serviceAllocations.reduce((sum, value) => sum + value, 0);
  for (let index = 0; serviceRemainder > 0 && index < serviceAllocations.length; index += 1) {
    serviceAllocations[index] += 1;
    serviceRemainder -= 1;
  }

  for (const [itemIndex, item] of lineItems.entries()) {
    const excluded = new Set(item.excludedParticipantIds || []);
    const included = item.assignedParticipantIds.filter(
      (participantId) => !excluded.has(participantId)
    );
    if (included.length === 0) continue;

    const itemTotalCents = itemCents[itemIndex] + serviceAllocations[itemIndex];
    const baseShare = Math.floor(itemTotalCents / included.length);
    let remainder = itemTotalCents % included.length;
    for (const participantId of included) {
      const allocated = baseShare + (remainder > 0 ? 1 : 0);
      remainder = Math.max(0, remainder - 1);
      sharesInCents.set(participantId, (sharesInCents.get(participantId) || 0) + allocated);
    }
  }

  return Object.fromEntries(
    Array.from(sharesInCents.entries()).map(([participantId, value]) => [
      participantId,
      roundCurrency(value / 100)
    ])
  );
}
