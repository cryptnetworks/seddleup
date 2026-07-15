"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type AppNavLinkProps = {
  href: string;
  children: React.ReactNode;
  prominent?: boolean;
  section?: boolean;
  className?: string;
};

export function AppNavLink({
  href,
  children,
  prominent = false,
  section = false,
  className = ""
}: AppNavLinkProps) {
  const pathname = usePathname();
  const active =
    pathname === href ||
    (section &&
      pathname.startsWith(`${href}/`) &&
      !(href === "/trips" && pathname === "/trips/new"));

  return (
    <Link
      className={
        prominent
          ? `btn-primary ${className}`
          : `min-h-11 rounded-lg px-3 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean ${
              active ? "bg-brand-soft text-ocean" : "text-muted hover:bg-surface hover:text-ink"
            } ${className}`
      }
      href={href}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </Link>
  );
}
