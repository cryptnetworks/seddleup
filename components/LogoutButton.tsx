"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

type LogoutButtonProps = {
  variant?: "nav" | "menu" | "mobile" | "button";
};

const styles = {
  nav: "btn-secondary gap-2",
  menu: "nav-link w-full justify-start text-ink",
  mobile:
    "flex min-h-12 min-w-0 w-full flex-col items-center justify-center gap-1 rounded-lg px-1 py-1.5 text-xs font-semibold text-muted transition hover:bg-surface hover:text-ink",
  button: "btn-danger gap-2"
};

export function LogoutButton({ variant = "button" }: LogoutButtonProps) {
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function logout() {
    setError("");
    setIsPending(true);

    try {
      await signOut({ callbackUrl: "/login?logout=1" });
    } catch {
      setIsPending(false);
      setError("Logout failed. Try again.");
    }
  }

  return (
    <span className={variant === "mobile" ? "flex min-w-0 flex-col items-center" : "block"}>
      <button
        className={styles[variant]}
        data-testid={variant === "mobile" ? "mobile-nav-logout" : "logout-button"}
        type="button"
        disabled={isPending}
        onClick={logout}
      >
        <LogOut className="h-5 w-5" aria-hidden />
        <span className={variant === "mobile" ? "max-w-full truncate" : undefined}>
          {isPending ? "Logging out..." : "Logout"}
        </span>
      </button>
      {error ? <span className="mt-1 block break-words text-xs text-coral">{error}</span> : null}
    </span>
  );
}
