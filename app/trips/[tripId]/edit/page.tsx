import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { updateTrip } from "@/lib/actions";
import { dateInputValue } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { requireTripAccess } from "@/lib/trip-access";
import { isTripManager } from "@/lib/trip-permissions";

export default async function EditTripPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const user = await requireUser();
  const resolved = await requireTripAccess(tripId, user.id);
  if (!isTripManager(resolved.access.role)) notFound();
  const trip = await prisma.trip.findFirst({
    where: { id: tripId }
  });
  if (!trip) notFound();

  const action = updateTrip.bind(null, trip.id);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Trips"
        title="Edit trip"
        description="Update the trip name, destination, or dates."
      />
      <section className="card mx-auto max-w-2xl p-4 sm:p-5">
        <form className="grid min-w-0 gap-4" action={action} data-testid="trip-form">
          <div>
            <label className="label" htmlFor="name">
              Trip name
            </label>
            <input
              className="field"
              data-testid="trip-name"
              id="name"
              name="name"
              defaultValue={trip.name}
              maxLength={140}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="destination">
              Destination
            </label>
            <input
              className="field"
              data-testid="trip-destination"
              id="destination"
              name="destination"
              defaultValue={trip.destination || ""}
              maxLength={140}
            />
          </div>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <label className="label" htmlFor="startDate">
                Start date
              </label>
              <input
                className="field"
                data-testid="trip-start-date"
                id="startDate"
                name="startDate"
                type="date"
                defaultValue={dateInputValue(trip.startDate)}
              />
            </div>
            <div className="min-w-0">
              <label className="label" htmlFor="endDate">
                End date
              </label>
              <input
                className="field"
                data-testid="trip-end-date"
                id="endDate"
                name="endDate"
                type="date"
                defaultValue={dateInputValue(trip.endDate)}
              />
            </div>
          </div>
          <button className="btn-primary" data-testid="trip-submit" type="submit">
            Save changes
          </button>
        </form>
      </section>
    </PageShell>
  );
}
