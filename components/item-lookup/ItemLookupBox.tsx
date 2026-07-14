"use client";

import { useState, useTransition } from "react";
import { Search } from "lucide-react";
import type { ItemLookupResult } from "@/lib/item-lookup/types";

export function ItemLookupBox() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ItemLookupResult[]>([]);
  const [isPending, startTransition] = useTransition();

  function search() {
    startTransition(async () => {
      const response = await fetch(`/api/item-lookup/search?q=${encodeURIComponent(query)}`);
      const payload = (await response.json()) as { results: ItemLookupResult[] };
      setResults(payload.results);
    });
  }

  function applyResult(result: ItemLookupResult) {
    const title = document.querySelector<HTMLInputElement>("#title");
    const amount = document.querySelector<HTMLInputElement>("#amount");
    if (title) title.value = result.title;
    if (amount && result.price !== undefined) amount.value = result.price.toFixed(2);
  }

  return (
    <div className="min-w-0 rounded-lg border border-line bg-surface p-3">
      <label className="label" htmlFor="itemLookup">
        Item lookup
      </label>
      <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <input
          className="field"
          id="itemLookup"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search product catalog"
        />
        <button
          className="btn-secondary min-h-11"
          type="button"
          onClick={search}
          disabled={isPending}
        >
          <Search className="h-4 w-4" aria-hidden />
          <span className="sr-only">Search</span>
        </button>
      </div>
      {results.length > 0 ? (
        <div className="mt-3 grid gap-2">
          {results.map((result) => (
            <button
              key={result.externalId}
              className="min-h-11 min-w-0 rounded-lg border border-line bg-white p-3 text-left text-sm hover:border-ocean focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean focus-visible:ring-offset-2"
              type="button"
              onClick={() => applyResult(result)}
            >
              <span className="block break-words font-semibold text-ink">{result.title}</span>
              <span className="block break-words text-muted">
                {result.retailer}
                {result.price === undefined
                  ? ""
                  : ` - ${result.currency} ${result.price.toFixed(2)}`}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
