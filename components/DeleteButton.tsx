"use client";

import { Trash2 } from "lucide-react";

type DeleteButtonProps = {
  action: () => Promise<void>;
  label: string;
};

export function DeleteButton({ action, label }: DeleteButtonProps) {
  return (
    <form action={action}>
      <button
        className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-red-100 text-coral hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-coral"
        type="submit"
        aria-label={label}
        onClick={(event) => {
          if (!window.confirm("Delete this item? This action cannot be undone.")) {
            event.preventDefault();
          }
        }}
      >
        <Trash2 className="h-4 w-4" aria-hidden />
      </button>
    </form>
  );
}
