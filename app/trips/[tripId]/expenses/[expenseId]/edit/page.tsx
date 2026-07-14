import { notFound } from "next/navigation";
import { DeleteButton } from "@/components/DeleteButton";
import { ExpenseForm } from "@/components/ExpenseForm";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { deleteExpense, updateExpense } from "@/lib/actions";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { requireTripAccess } from "@/lib/trip-access";
import {
  allowedExpenseStatusesForRole,
  canEditExpense,
  isTripManager
} from "@/lib/trip-permissions";

export default async function EditExpensePage({
  params
}: {
  params: Promise<{ tripId: string; expenseId: string }>;
}) {
  const { tripId, expenseId } = await params;
  const user = await requireUser();
  const resolved = await requireTripAccess(tripId, user.id);
  const trip = await prisma.trip.findFirst({
    where: { id: tripId },
    include: {
      participants: { orderBy: { createdAt: "asc" } },
      expenses: {
        where: { id: expenseId },
        include: { shares: true }
      }
    }
  });

  if (!trip || trip.expenses.length === 0) notFound();

  const expense = trip.expenses[0];
  if (!canEditExpense(resolved.access.role, user.id, expense)) notFound();
  const action = updateExpense.bind(null, trip.id, expense.id);
  const removeExpense = deleteExpense.bind(null, trip.id, expense.id);
  const payerOptions = isTripManager(resolved.access.role)
    ? trip.participants
    : trip.participants.filter((participant) => participant.userId === user.id);
  const statusOptions = allowedExpenseStatusesForRole(resolved.access.role);

  return (
    <PageShell>
      <PageHeader
        eyebrow={trip.name}
        title="Edit expense"
        description="Update the cost details or remove this expense."
      />
      <section className="card mx-auto max-w-2xl p-4 sm:p-5">
        <div className="mb-4 flex justify-end">
          <DeleteButton action={removeExpense} label={`Delete ${expense.title}`} />
        </div>
        <ExpenseForm
          action={action}
          participants={trip.participants}
          payerOptions={payerOptions}
          statusOptions={statusOptions}
          submitLabel="Save expense"
          expense={expense}
        />
      </section>
    </PageShell>
  );
}
