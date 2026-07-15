import Link from "next/link";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    href: string;
  };
};

export function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
  return (
    <header className="mb-5 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="mb-1 text-sm font-semibold text-ocean">{eyebrow}</p> : null}
        <h1 className="break-words text-2xl font-bold leading-tight text-ink sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted md:text-base">{description}</p>
        ) : null}
      </div>
      {action ? (
        <Link
          className="btn-primary w-full sm:w-auto"
          data-testid={action.href === "/trips/new" ? "dashboard-create-trip" : undefined}
          href={action.href}
        >
          {action.label}
        </Link>
      ) : null}
    </header>
  );
}
