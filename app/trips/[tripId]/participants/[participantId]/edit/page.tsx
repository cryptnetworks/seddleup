import { notFound } from "next/navigation";
import { DeleteButton } from "@/components/DeleteButton";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { deleteParticipant, updateParticipant } from "@/lib/actions";
import {
  hasParticipantFinancialDependencies,
  participantDependencySummary
} from "@/lib/participant-integrity";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { requireTripAccess } from "@/lib/trip-access";
import { isTripManager } from "@/lib/trip-permissions";

export default async function EditParticipantPage({
  params,
  searchParams
}: {
  params: Promise<{ tripId: string; participantId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { tripId, participantId } = await params;
  const query = await searchParams;
  const user = await requireUser();
  const resolved = await requireTripAccess(tripId, user.id);
  if (!isTripManager(resolved.access.role)) notFound();
  const participant = await prisma.participant.findFirst({
    where: {
      id: participantId,
      tripId
    },
    include: {
      trip: true,
      _count: {
        select: {
          expensesPaid: true,
          shares: true,
          receiptSplits: true,
          paymentsSent: true,
          paymentsReceived: true
        }
      }
    }
  });

  if (!participant) notFound();

  const action = updateParticipant.bind(null, tripId, participant.id);
  const removeParticipant = deleteParticipant.bind(null, tripId, participant.id);
  const dependencies = {
    expensesPaid: participant._count.expensesPaid,
    expenseShares: participant._count.shares,
    receiptAssignments: participant._count.receiptSplits,
    paymentsSent: participant._count.paymentsSent,
    paymentsReceived: participant._count.paymentsReceived
  };
  const deletionBlocked = hasParticipantFinancialDependencies(dependencies);

  return (
    <PageShell>
      <PageHeader
        eyebrow={participant.trip.name}
        title="Edit participant"
        description="Update traveler details or remove them from this trip."
      />
      <section className="card mx-auto max-w-2xl p-4 sm:p-5">
        {query.error === "financial-history" || deletionBlocked ? (
          <p className="mb-4 rounded-lg border border-line bg-surface p-3 text-sm text-coral">
            This participant cannot be deleted because financial history references them
            {deletionBlocked ? `: ${participantDependencySummary(dependencies)}` : ""}. Reassigning
            or archiving financial history requires a separate reviewed workflow.
          </p>
        ) : (
          <div className="mb-4 flex justify-end">
            <DeleteButton
              action={removeParticipant}
              label={`Delete ${participant.name}`}
              confirmMessage="Delete this participant? This is allowed only when no financial history references them."
            />
          </div>
        )}
        <form className="grid min-w-0 gap-4" action={action} data-testid="participant-form">
          <div>
            <label className="label" htmlFor="name">
              Name
            </label>
            <input
              className="field"
              data-testid="participant-name"
              id="name"
              name="name"
              defaultValue={participant.name}
              maxLength={120}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              className="field"
              data-testid="participant-email"
              id="email"
              name="email"
              type="email"
              defaultValue={participant.email || ""}
              maxLength={120}
            />
          </div>
          <button className="btn-primary" data-testid="participant-submit" type="submit">
            Save participant
          </button>
        </form>
      </section>
    </PageShell>
  );
}
