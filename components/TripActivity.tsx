import { CircleMinus, FileText, Link2, Pencil, Plane, Plus } from "lucide-react";
import {
  describeTripActivity,
  formatTripActivityTime,
  type TripActivityEntry,
  type TripActivityKind
} from "@/lib/audit-display";

const icons = {
  trip: Plane,
  add: Plus,
  edit: Pencil,
  remove: CircleMinus,
  receipt: FileText,
  share: Link2
} satisfies Record<TripActivityKind, typeof Plane>;

export function TripActivity({ entries }: { entries: TripActivityEntry[] }) {
  return (
    <section className="card p-3 sm:p-4" data-testid="trip-activity">
      <h2 className="mb-1 text-lg font-semibold text-ink">Trip activity</h2>
      <p className="mb-4 text-sm text-muted">The latest changes made by your trip group.</p>
      {entries.length === 0 ? (
        <p className="text-sm text-muted">New expenses and traveler changes will appear here.</p>
      ) : (
        <ol className="grid gap-1">
          {entries.map((entry) => {
            const activity = describeTripActivity(entry);
            const Icon = icons[activity.kind];

            return (
              <li
                key={entry.id}
                className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3 border-b border-line py-3 last:border-b-0"
                data-testid="trip-activity-item"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft text-ocean">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-5 text-ink">{activity.summary}</p>
                  {activity.detail ? (
                    <p className="mt-0.5 text-xs leading-5 text-muted">{activity.detail}</p>
                  ) : null}
                  <time
                    className="mt-0.5 block text-xs text-muted"
                    dateTime={entry.createdAt.toISOString()}
                  >
                    {formatTripActivityTime(entry.createdAt)}
                  </time>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
