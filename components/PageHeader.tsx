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
    <header className="mb-7 flex min-w-0 flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-ocean">{eyebrow}</p>
        ) : null}
        <h1 className="break-words text-3xl font-bold leading-tight tracking-tight text-ink md:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted md:text-base md:leading-7">
            {description}
          </p>
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
