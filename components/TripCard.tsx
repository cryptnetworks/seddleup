import type { Trip } from "@prisma/client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";

type TripCardProps = {
  trip: Trip & {
    participants: unknown[];
    expenses: { amount: unknown }[];
  };
};

export function TripCard({ trip }: TripCardProps) {
  const total = trip.expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);

  return (
    <Link href={`/trips/${trip.id}`} className="block min-w-0" data-testid="trip-card-link">
      <article
        className="card h-full p-4 transition hover:-translate-y-0.5 hover:border-ocean/40"
        data-testid="trip-card"
      >
        <p className="break-words text-xs font-bold uppercase tracking-normal text-ocean">
          {trip.destination || "Destination pending"}
        </p>
        <h2 className="mt-2 break-words text-xl font-semibold text-ink">{trip.name}</h2>
        <p className="mt-1 text-sm text-muted">
          {formatDate(trip.startDate)} - {formatDate(trip.endDate)}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
          <span className="rounded-lg bg-surface px-3 py-2">
            <strong className="block break-all text-ink">{trip.participants.length}</strong>
            People
          </span>
          <span className="rounded-lg bg-surface px-3 py-2">
            <strong className="block break-all text-ink">{trip.expenses.length}</strong>
            Expenses
          </span>
          <span className="col-span-2 rounded-lg bg-surface px-3 py-2 sm:col-span-1">
            <strong className="block break-all font-semibold tabular-nums text-ink">
              {formatCurrency(total)}
            </strong>
            Total
          </span>
        </div>
        <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-ocean">
          View trip <ArrowRight className="h-4 w-4" aria-hidden />
        </div>
      </article>
    </Link>
  );
}
