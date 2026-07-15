type StatCardProps = {
  label: string;
  value: string | number;
  description?: string;
  compact?: boolean;
};

export function StatCard({ label, value, description, compact = false }: StatCardProps) {
  return (
    <article className={`stat-card ${compact ? "p-3 sm:p-4" : ""}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className="mt-2 break-all text-2xl font-bold tracking-tight text-ink sm:text-3xl">
        {value}
      </p>
      {description ? <p className="mt-2 text-xs leading-5 text-muted">{description}</p> : null}
    </article>
  );
}
