import { CloudflareWebAnalytics } from "@/components/CloudflareWebAnalytics";

export default function MarketingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {children}
      <CloudflareWebAnalytics />
    </>
  );
}
