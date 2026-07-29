"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { searchBreeds, type Breed, type Species } from "@/lib/breeds";

/**
 * Picks a breed from the list we maintain, filtered by species.
 *
 * A filter over real buttons rather than a custom combobox: the results are
 * focusable, activate on Enter or Space and read correctly to a screen reader
 * without a line of aria-activedescendant bookkeeping. A species has at most a
 * couple of dozen breeds, so there is nothing here worth a widget.
 *
 * "One of One" always sorts to the top. A crossbred dog is the single most
 * common case in South Africa, and burying it under twenty pedigrees would tell
 * that customer their animal is an afterthought. See docs/spec-print-layout.md
 * section 3 for why the phrase it replaces is never used.
 *
 * @param species narrows the list; "other" has no breed list and must not
 * render this component.
 * @param value the selected breed id, or null.
 * @param onChange called with the chosen breed.
 * @param onMiss called with the current query when the customer says the breed
 * is not listed. The parent logs it.
 */
export function BreedPicker({
  species,
  value,
  onChange,
  onMiss,
}: {
  species: Exclude<Species, "other">;
  value: string | null;
  onChange: (breed: Breed) => void;
  onMiss: (query: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [reported, setReported] = useState(false);

  const matches = searchBreeds(species, query);
  // Partition rather than sort: keeps the list's own order inside each group.
  const results = [
    ...matches.filter((b) => b.oneOfOne),
    ...matches.filter((b) => !b.oneOfOne),
  ];

  function report() {
    onMiss(query);
    setReported(true);
  }

  return (
    <div className="flex flex-col gap-3">
      <Input
        label="Their breed"
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setReported(false);
        }}
        placeholder="Start typing"
        autoComplete="off"
      />

      <p role="status" className="sr-only">
        {results.length} breeds match
      </p>

      {results.length > 0 ? (
        <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
          {results.map((breed) => {
            const selected = breed.id === value;
            return (
              <li key={breed.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onChange(breed)}
                  className={cn(
                    "w-full rounded-md border px-3 py-2 text-left text-base",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                    "focus-visible:ring-offset-2 focus-visible:ring-offset-base",
                    selected
                      ? "border-btn bg-surface text-ink"
                      : "border-line bg-base text-ink hover:bg-surface",
                  )}
                >
                  {breed.name}
                  {breed.origin ? (
                    <span className="ml-2 text-sm text-muted">
                      {breed.origin}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted">
          Nothing matches {`"${query}"`} yet.
        </p>
      )}

      {reported ? (
        <p className="text-sm text-muted">
          Thank you, we have noted it. Choose One of One for now and their plate
          will still be right.
        </p>
      ) : (
        <button
          type="button"
          onClick={report}
          disabled={query.trim() === ""}
          className={cn(
            "self-start text-sm underline underline-offset-2",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
            "focus-visible:ring-offset-2 focus-visible:ring-offset-base",
            query.trim() === ""
              ? "cursor-not-allowed text-muted opacity-60"
              : "text-accent",
          )}
        >
          Can&apos;t find them?
        </button>
      )}
    </div>
  );
}
