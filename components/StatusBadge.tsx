type StatusTone = "success" | "danger" | "warning" | "neutral";

type StatusBadgeProps = {
  children: React.ReactNode;
  tone?: StatusTone;
};

const toneClasses: Record<StatusTone, string> = {
  success: "badge-success",
  danger: "badge-danger",
  warning: "badge-warning",
  neutral: "badge-neutral"
};

export function StatusBadge({ children, tone = "neutral" }: StatusBadgeProps) {
  return <span className={toneClasses[tone]}>{children}</span>;
}
