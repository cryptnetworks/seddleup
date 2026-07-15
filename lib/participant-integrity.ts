import type { Prisma, PrismaClient } from "@prisma/client";

type ParticipantIntegrityClient = PrismaClient | Prisma.TransactionClient;

export type ParticipantFinancialDependencies = {
  expensesPaid: number;
  expenseShares: number;
  receiptAssignments: number;
  paymentsSent: number;
  paymentsReceived: number;
};

export function hasParticipantFinancialDependencies(
  dependencies: ParticipantFinancialDependencies
) {
  return Object.values(dependencies).some((count) => count > 0);
}

export async function participantFinancialDependencies(
  client: ParticipantIntegrityClient,
  participantId: string
): Promise<ParticipantFinancialDependencies> {
  const [expensesPaid, expenseShares, receiptAssignments, paymentsSent, paymentsReceived] =
    await Promise.all([
      client.expense.count({ where: { payerId: participantId } }),
      client.expenseShare.count({ where: { participantId } }),
      client.receiptLineItemParticipant.count({ where: { participantId } }),
      client.tripPayment.count({ where: { senderParticipantId: participantId } }),
      client.tripPayment.count({ where: { recipientParticipantId: participantId } })
    ]);

  return { expensesPaid, expenseShares, receiptAssignments, paymentsSent, paymentsReceived };
}

export function participantDependencySummary(dependencies: ParticipantFinancialDependencies) {
  const parts: string[] = [];
  if (dependencies.expensesPaid) {
    parts.push(
      `${dependencies.expensesPaid} paid expense${dependencies.expensesPaid === 1 ? "" : "s"}`
    );
  }
  if (dependencies.expenseShares) {
    parts.push(
      `${dependencies.expenseShares} expense share${dependencies.expenseShares === 1 ? "" : "s"}`
    );
  }
  if (dependencies.receiptAssignments) {
    parts.push(
      `${dependencies.receiptAssignments} receipt assignment${dependencies.receiptAssignments === 1 ? "" : "s"}`
    );
  }
  if (dependencies.paymentsSent) {
    parts.push(
      `${dependencies.paymentsSent} payment${dependencies.paymentsSent === 1 ? "" : "s"} sent`
    );
  }
  if (dependencies.paymentsReceived) {
    parts.push(
      `${dependencies.paymentsReceived} payment${dependencies.paymentsReceived === 1 ? "" : "s"} received`
    );
  }
  return parts.join(", ");
}
