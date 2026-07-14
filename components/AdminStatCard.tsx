type AdminStatCardProps = {
  label: string;
  value: string | number;
  description?: string;
};

export function AdminStatCard({ label, value, description }: AdminStatCardProps) {
  return (
    <article className="card p-3 sm:p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 break-all text-3xl font-bold text-ink">{value}</p>
      {description ? <p className="mt-2 text-xs leading-5 text-muted">{description}</p> : null}
    </article>
  );
}
