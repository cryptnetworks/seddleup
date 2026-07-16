"use client";

import { Trash2 } from "lucide-react";

type DeleteButtonProps = {
  action: () => Promise<void>;
  label: string;
  confirmMessage?: string;
};

export function DeleteButton({ action, label, confirmMessage }: DeleteButtonProps) {
  return (
    <form action={action}>
      <button
        className="icon-button text-coral hover:border-coral hover:bg-[var(--app-danger-soft)] hover:text-coral"
        type="submit"
        aria-label={label}
        onClick={(event) => {
          if (
            !window.confirm(confirmMessage || "Delete this item? This action cannot be undone.")
          ) {
            event.preventDefault();
          }
        }}
      >
        <Trash2 className="h-4 w-4" aria-hidden />
      </button>
    </form>
  );
}
