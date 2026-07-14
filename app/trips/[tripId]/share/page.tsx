import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { TripShareControls } from "@/components/TripShareControls";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_TRIP_SHARE_NAME_MODE,
  tripShareNameModes,
  tripShareStatus,
  type TripShareNameMode
} from "@/lib/trip-sharing";
import { requireUser } from "@/lib/session";
import { requireTripAccess } from "@/lib/trip-access";
import { isTripManager } from "@/lib/trip-permissions";

export default async function TripShareManagementPage({
  params
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const user = await requireUser();
  const resolved = await requireTripAccess(tripId, user.id);
  if (!isTripManager(resolved.access.role)) notFound();

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { name: true, shareLink: true }
  });
  if (!trip) notFound();

  const linkStatus = trip.shareLink ? tripShareStatus(trip.shareLink) : null;
  const participantNameMode = tripShareNameModes.includes(
    trip.shareLink?.participantNameMode as TripShareNameMode
  )
    ? (trip.shareLink?.participantNameMode as TripShareNameMode)
    : DEFAULT_TRIP_SHARE_NAME_MODE;

  return (
    <PageShell>
      <PageHeader
        eyebrow={trip.name}
        title="Share read-only trip costs"
        description="Create and manage an unlisted bearer link to a deliberately limited trip-cost summary."
      />

      <section className="mb-5 grid gap-3 sm:grid-cols-3" aria-label="Sharing status">
        <div className="card p-4">
          <p className="text-sm text-muted">Status</p>
          <p className="mt-1 font-semibold capitalize text-ink">{linkStatus || "not enabled"}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-muted">Created</p>
          <p className="mt-1 font-semibold text-ink">
            {trip.shareLink ? formatDate(trip.shareLink.createdAt) : "Not created"}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-muted">Expiration</p>
          <p className="mt-1 font-semibold text-ink">
            {trip.shareLink?.expiresAt
              ? formatDate(trip.shareLink.expiresAt)
              : trip.shareLink
                ? "Valid until revoked"
                : "Not configured"}
          </p>
        </div>
      </section>

      <TripShareControls
        tripId={tripId}
        linkStatus={linkStatus}
        participantNameMode={participantNameMode}
      />
    </PageShell>
  );
}
