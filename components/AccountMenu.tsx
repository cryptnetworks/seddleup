"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Settings, UserCircle } from "lucide-react";
import { LogoutButton } from "@/components/LogoutButton";
import { ThemeToggle } from "@/components/ThemeToggle";

type AccountMenuProps = {
  name?: string | null;
  email?: string | null;
};

export function AccountMenu({ name, email }: AccountMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const displayName = name || email || "Account";

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  return (
    <div className="relative min-w-0" ref={menuRef}>
      <button
        className="btn-secondary gap-2"
        data-testid="account-menu-trigger"
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => setIsOpen((current) => !current)}
      >
        <UserCircle className="h-4 w-4" aria-hidden />
        <span className="max-w-32 truncate">{displayName}</span>
      </button>

      {isOpen ? (
        <div
          className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-line p-2 shadow-soft"
          style={{ backgroundColor: "var(--app-card-solid)" }}
          role="menu"
          data-testid="account-menu"
        >
          <div className="border-b border-line px-3 py-2">
            <p className="truncate text-sm font-semibold text-ink">{displayName}</p>
            {email ? <p className="truncate text-xs text-muted">{email}</p> : null}
          </div>
          <div className="grid gap-1 py-2">
            <Link
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-ink transition hover:bg-surface focus:outline-none focus:ring-2 focus:ring-ocean"
              href="/account"
              role="menuitem"
              onClick={() => setIsOpen(false)}
            >
              <Settings className="h-4 w-4" aria-hidden />
              Account settings
            </Link>
            <div className="px-1">
              <ThemeToggle />
            </div>
            <LogoutButton variant="menu" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
