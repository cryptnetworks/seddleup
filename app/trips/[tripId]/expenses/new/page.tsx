import { notFound, redirect } from "next/navigation";
import { ExpenseForm } from "@/components/ExpenseForm";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { createExpense } from "@/lib/actions";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { requireTripAccess } from "@/lib/trip-access";
import {
  allowedExpenseStatusesForRole,
  canCreateTripExpense,
  isTripManager
} from "@/lib/trip-permissions";

export default async function NewExpensePage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const user = await requireUser();
  const resolved = await requireTripAccess(tripId, user.id);
  if (!canCreateTripExpense(resolved.access.role)) notFound();
  const trip = await prisma.trip.findFirst({
    where: { id: tripId },
    include: { participants: { orderBy: { createdAt: "asc" } } }
  });

  if (!trip) notFound();
  if (trip.participants.length === 0) redirect(`/trips/${trip.id}?error=no-participants`);

  const action = createExpense.bind(null, trip.id);
  const payerOptions = isTripManager(resolved.access.role)
    ? trip.participants
    : trip.participants.filter((participant) => participant.userId === user.id);
  if (payerOptions.length === 0) redirect(`/trips/${trip.id}?error=participant-link-required`);
  const statusOptions = allowedExpenseStatusesForRole(resolved.access.role).filter(
    (status) => status === "draft" || status === "submitted"
  );

  return (
    <PageShell>
      <PageHeader
        eyebrow={trip.name}
        title="Add expense"
        description="Choose the payer and everyone who shares this cost."
      />
      <section className="card mx-auto max-w-2xl p-5">
        <ExpenseForm
          action={action}
          participants={trip.participants}
          payerOptions={payerOptions}
          statusOptions={statusOptions}
          submitLabel="Record expense"
        />
      </section>
    </PageShell>
  );
}
