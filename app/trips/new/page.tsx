import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { createTrip } from "@/lib/actions";
import { requireUser } from "@/lib/session";

export default async function NewTripPage() {
  await requireUser();

  return (
    <PageShell>
      <PageHeader
        eyebrow="Trips"
        title="Create trip"
        description="Add the core trip details. Participants and expenses come next."
      />
      <section className="card mx-auto max-w-2xl p-4 sm:p-5">
        <form className="grid min-w-0 gap-4" action={createTrip} data-testid="trip-form">
          <div>
            <label className="label" htmlFor="name">
              Trip name
            </label>
            <input
              className="field"
              data-testid="trip-name"
              id="name"
              name="name"
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
              />
            </div>
          </div>
          <button className="btn-primary" data-testid="trip-submit" type="submit">
            Save trip
          </button>
        </form>
      </section>
    </PageShell>
  );
}
