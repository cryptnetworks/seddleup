import Link from "next/link";
import Image from "next/image";

type EmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
};

export function EmptyState({ title, description, actionLabel, actionHref }: EmptyStateProps) {
  return (
    <div className="card flex min-h-64 min-w-0 flex-col items-center justify-center px-5 py-10 text-center sm:px-8 sm:py-12">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-xl bg-brand-soft p-2">
        <Image
          src="/mark-512.png"
          alt=""
          width={512}
          height={512}
          className="h-full w-full object-contain"
          sizes="64px"
        />
      </div>
      <h2 className="break-words text-xl font-bold tracking-tight text-ink">{title}</h2>
      <p className="mt-2 max-w-md break-words text-sm leading-6 text-muted">{description}</p>
      {actionLabel && actionHref ? (
        <Link
          className="btn-primary mt-5"
          data-testid={actionHref === "/trips/new" ? "dashboard-create-trip" : undefined}
          href={actionHref}
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
