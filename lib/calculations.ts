import type { Expense, ExpenseShare, Participant } from "@prisma/client";

export type ParticipantWithBalances<
  TParticipant extends Pick<Participant, "id" | "name"> = Participant
> = {
  participant: TParticipant;
  paid: number;
  owed: number;
  net: number;
};

export type Settlement = {
  debtorId: string;
  debtorName: string;
  creditorId: string;
  creditorName: string;
  amount: number;
  label: string;
};

export type BalanceExpenseInput = Pick<Expense, "amount" | "payerId"> & {
  shares: Pick<ExpenseShare, "participantId" | "shareAmount">[];
};

export function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateEqualShares(amount: number, participantCount: number) {
  if (participantCount <= 0) {
    return [];
  }

  const cents = Math.round(amount * 100);
  const base = Math.floor(cents / participantCount);
  const remainder = cents % participantCount;

  return Array.from(
    { length: participantCount },
    (_, index) => (base + (index < remainder ? 1 : 0)) / 100
  );
}

export function calculateBalances<TParticipant extends Pick<Participant, "id" | "name">>(
  participants: TParticipant[],
  expenses: BalanceExpenseInput[]
) {
  const totals = new Map<string, ParticipantWithBalances<TParticipant>>();

  for (const participant of participants) {
    totals.set(participant.id, {
      participant,
      paid: 0,
      owed: 0,
      net: 0
    });
  }

  for (const expense of expenses) {
    const payer = totals.get(expense.payerId);
    if (payer) {
      payer.paid = roundCurrency(payer.paid + Number(expense.amount));
    }

    if (expense.shares.length > 0) {
      for (const share of expense.shares) {
        const participant = totals.get(share.participantId);
        if (participant) {
          participant.owed = roundCurrency(participant.owed + Number(share.shareAmount));
        }
      }
    } else {
      const equalShares = calculateEqualShares(Number(expense.amount), participants.length);
      participants.forEach((participant, index) => {
        const summary = totals.get(participant.id);
        if (summary) {
          summary.owed = roundCurrency(summary.owed + equalShares[index]);
        }
      });
    }
  }

  for (const summary of totals.values()) {
    summary.net = roundCurrency(summary.paid - summary.owed);
  }

  const balances = Array.from(totals.values());
  return {
    balances,
    settlements: generateSettlementSuggestions(balances)
  };
}

export function generateSettlementSuggestions<
  TParticipant extends Pick<Participant, "id" | "name">
>(balances: ParticipantWithBalances<TParticipant>[]): Settlement[] {
  const creditors = balances
    .filter((item) => item.net > 0)
    .map((item) => ({ ...item }))
    .sort((a, b) => b.net - a.net);
  const debtors = balances
    .filter((item) => item.net < 0)
    .map((item) => ({ ...item }))
    .sort((a, b) => a.net - b.net);

  const settlements: Settlement[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amount = roundCurrency(Math.min(creditor.net, -debtor.net));

    if (amount <= 0) {
      break;
    }

    settlements.push({
      debtorId: debtor.participant.id,
      debtorName: debtor.participant.name,
      creditorId: creditor.participant.id,
      creditorName: creditor.participant.name,
      amount,
      label: `${debtor.participant.name} owes ${creditor.participant.name} $${amount.toFixed(2)}`
    });

    debtor.net = roundCurrency(debtor.net + amount);
    creditor.net = roundCurrency(creditor.net - amount);

    if (Math.abs(debtor.net) < 0.01) debtorIndex += 1;
    if (Math.abs(creditor.net) < 0.01) creditorIndex += 1;
  }

  return settlements;
}
