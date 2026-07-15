import { notFound } from "next/navigation";
import { DeleteButton } from "@/components/DeleteButton";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { TripPaymentEditForm } from "@/components/TripPaymentForm";
import { deleteTripPayment, updateTripPayment } from "@/lib/actions";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { requireTripAccess } from "@/lib/trip-access";
import { canEditConfirmedTripPayment } from "@/lib/trip-permissions";

export default async function EditTripPaymentPage({
  params,
  searchParams
}: {
  params: Promise<{ tripId: string; paymentId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { tripId, paymentId } = await params;
  const { error } = await searchParams;
  const user = await requireUser();
  const resolved = await requireTripAccess(tripId, user.id);
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: {
      id: true,
      name: true,
      payments: {
        where: { id: paymentId },
        include: {
          sender: { select: { id: true, name: true } },
          recipient: { select: { id: true, name: true, userId: true } }
        }
      }
    }
  });
  if (!trip || trip.payments.length === 0) notFound();
  const payment = trip.payments[0];
  if (
    !canEditConfirmedTripPayment(resolved.access.role, user.id, {
      confirmedByUserId: payment.confirmedByUserId,
      recipientParticipantUserId: payment.recipient.userId
    })
  ) {
    notFound();
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow={trip.name}
        title="Edit payment confirmation"
        description="Only the payment date and private note can be corrected."
      />
      <section className="card mx-auto max-w-2xl p-4 sm:p-5">
        <div className="mb-4 flex justify-end">
          <DeleteButton
            action={deleteTripPayment.bind(null, trip.id, payment.id)}
            label="Delete payment confirmation"
          />
        </div>
        <TripPaymentEditForm
          action={updateTripPayment.bind(null, trip.id, payment.id)}
          error={error}
          payment={payment}
        />
      </section>
    </PageShell>
  );
}
