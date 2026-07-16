import { roundCurrency } from "@/lib/calculations";

export type ReceiptSplitLineItem = {
  id: string;
  totalPrice: number;
  assignedParticipantIds: string[];
  excludedParticipantIds?: string[];
};

export function calculateReceiptItemizedShares({
  lineItems,
  participantIds,
  tax = 0,
  tip = 0
}: {
  lineItems: ReceiptSplitLineItem[];
  participantIds: string[];
  tax?: number;
  tip?: number;
}) {
  const sharesInCents = new Map(participantIds.map((participantId) => [participantId, 0]));
  const itemCents = lineItems.map((item) => Math.round(item.totalPrice * 100));
  const itemSubtotalCents = itemCents.reduce((sum, value) => sum + value, 0);
  const serviceCents = Math.round((tax + tip) * 100);
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
