import { StatCard } from "@/components/StatCard";

type AdminStatCardProps = {
  label: string;
  value: string | number;
  description?: string;
};

export function AdminStatCard({ label, value, description }: AdminStatCardProps) {
  return <StatCard label={label} value={value} description={description} />;
}
