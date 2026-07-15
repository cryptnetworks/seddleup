import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { TripPaymentConfirmationForm } from "@/components/TripPaymentForm";
import { createTripPayment } from "@/lib/actions";
import { calculateBalances } from "@/lib/calculations";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { requireTripAccess } from "@/lib/trip-access";
import { canConfirmTripPayment } from "@/lib/trip-permissions";

export default async function NewTripPaymentPage({
  params,
  searchParams
}: {
  params: Promise<{ tripId: string }>;
  searchParams: Promise<{ sender?: string; recipient?: string; error?: string }>;
}) {
  const { tripId } = await params;
  const query = await searchParams;
  const user = await requireUser();
  const resolved = await requireTripAccess(tripId, user.id);
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: {
      id: true,
      name: true,
      participants: {
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, userId: true }
      },
      expenses: {
        where: { status: { not: "draft" } },
        select: {
          amount: true,
          payerId: true,
          shares: { select: { participantId: true, shareAmount: true } }
        }
      },
      payments: {
        select: { amount: true, senderParticipantId: true, recipientParticipantId: true }
      }
    }
  });
  if (!trip) notFound();

  const sender = trip.participants.find((participant) => participant.id === query.sender);
  const recipient = trip.participants.find((participant) => participant.id === query.recipient);
  if (!sender || !recipient) redirect(`/trips/${tripId}?error=payment-participants`);
  if (
    !canConfirmTripPayment(resolved.access.role, user.id, {
      senderParticipantId: sender.id,
      recipientParticipantId: recipient.id,
      recipientParticipantUserId: recipient.userId
    })
  ) {
    redirect(`/trips/${tripId}?error=participant-link-required`);
  }

  const { settlements } = calculateBalances(trip.participants, trip.expenses, trip.payments);
  const settlement = settlements.find(
    (item) => item.debtorId === sender.id && item.creditorId === recipient.id
  );
  if (!settlement) redirect(`/trips/${tripId}?error=stale-payment`);

  return (
    <PageShell>
      <PageHeader
        eyebrow={trip.name}
        title="Confirm payment received"
        description="Confirm money you received against the current settlement suggestion."
      />
      <section className="card mx-auto max-w-2xl p-4 sm:p-5">
        <TripPaymentConfirmationForm
          action={createTripPayment.bind(null, trip.id)}
          error={query.error}
          outstandingAmount={settlement.amount}
          recipient={recipient}
          sender={sender}
        />
      </section>
    </PageShell>
  );
}
