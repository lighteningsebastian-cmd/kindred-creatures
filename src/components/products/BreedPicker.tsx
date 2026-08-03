"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { OTHER_MAX } from "@/lib/companion";
import {
  getBreed,
  searchBreeds,
  type Breed,
  type Species,
} from "@/lib/breeds";

/** More than this is a wall of names. The rest are reachable by typing more. */
const MAX_VISIBLE = 8;

/**
 * Picks a breed from the list we maintain, filtered by species.
 *
 * NOTHING IS SHOWN UNTIL THEY TYPE (owner decision, 30 July, reversing the
 * earlier shortlist). Results drop down as they type and close again once one is
 * chosen, and the field then reads back the breed they picked. The version that
 * left the field saying "Start typing" after a successful choice made a working
 * feature look broken, which is worse than a feature that is missing.
 *
 * A filter over real buttons rather than a custom combobox: the results are
 * focusable, activate on Enter or Space and read correctly to a screen reader
 * without a line of aria-activedescendant bookkeeping.
 *
 * "One of One" sorts above the pedigrees whenever it matches what was typed. A
 * crossbred dog is the single most common case in South Africa, and burying it
 * would tell that customer their animal is an afterthought. See
 * docs/spec-print-layout.md section 3 for why the phrase it replaces is unused.
 *
 * @param species narrows the list; "other" has no breed list and must not
 * render this component.
 * @param value the selected breed id, or null.
 * @param onChange called with the chosen breed.
 * @param onMiss called with the current query when the customer gives up on
 * the list. The parent logs it, so the list grows by demand.
 * @param typedBreedValue the breed in their own words, when they have written
 * one instead of picking.
 * @param onTypeBreed called with their words. Empty string clears it.
 */
export function BreedPicker({
  species,
  value,
  onChange,
  onMiss,
  typedBreedValue,
  onTypeBreed,
}: {
  species: Exclude<Species, "other">;
  value: string | null;
  onChange: (breed: Breed) => void;
  onMiss: (query: string) => void;
  typedBreedValue: string | null;
  onTypeBreed: (words: string) => void;
}) {
  const selected = value ? getBreed(value) : undefined;
  // Seeded from the selection so the field reads back what they chose, both on
  // first render and after they come back to the question later.
  const [query, setQuery] = useState(selected?.name ?? "");
  const [open, setOpen] = useState(false);
  // Seeded from the profile so coming back to this question shows their words
  // still there, rather than an empty field over a plate that already has them.
  const [typedBreed, setTypedBreed] = useState(typedBreedValue ?? "");
  const [ownWords, setOwnWords] = useState(Boolean(typedBreedValue?.trim()));

  const typed = query.trim();
  // Only ever a list while they are typing something that is not simply the
  // breed already chosen sitting in the field.
  const searching = typed !== "" && typed !== selected?.name;
  const matches = searching ? searchBreeds(species, query) : [];
  // Partition rather than sort: keeps the ranking's order inside each group.
  const ranked = [
    ...matches.filter((b) => b.oneOfOne),
    ...matches.filter((b) => !b.oneOfOne),
  ];
  const results = ranked.slice(0, MAX_VISIBLE);
  const hidden = ranked.length - results.length;
  const showList = open && searching;

  function choose(breed: Breed) {
    onChange(breed);
    // Read it back, and get out of the way.
    setQuery(breed.name);
    setOpen(false);
  }

  return (
    <div className="flex flex-col gap-3">
      {ownWords ? null : (
      <Input
        label="Their breed"
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Start typing"
        autoComplete="off"
        helperText={
          selected && !showList
            ? `${selected.name}. Type again to change it.`
            : undefined
        }
      />
      )}

      <p role="status" className="sr-only">
        {showList ? `${results.length} breeds match` : ""}
        {selected && !showList ? `${selected.name} selected` : ""}
      </p>

      {showList && !ownWords ? (
        <>
          {results.length > 0 ? (
            <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
              {results.map((breed) => {
                const isSelected = breed.id === value;
                return (
                  <li key={breed.id}>
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => choose(breed)}
                      className={cn(
                        "w-full rounded-md border px-3 py-2 text-left text-base",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                        "focus-visible:ring-offset-2 focus-visible:ring-offset-base",
                        isSelected
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
              Nothing matches {`"${typed}"`} yet.
            </p>
          )}

          {hidden > 0 ? (
            <p className="text-sm text-muted">
              {hidden} more. Keep typing to narrow it down.
            </p>
          ) : null}
        </>
      ) : null}

      {/*
        THE ESCAPE HATCH IS ALWAYS AVAILABLE. It used to be greyed out until you
        had typed something, which hid it from exactly the people most likely to
        need it: someone whose dog has no breed name to type does not start
        typing one. And it used to end in "thank you, we have noted it", which
        collected data for us and gave the customer nothing back.

        It resolves now. They write the breed in their own words, it goes on the
        plate as written, and it is still logged so the list grows towards what
        people actually own.
      */}
      {ownWords ? (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <Input
            label="What do you call their breed?"
            value={typedBreed}
            autoFocus
            maxLength={OTHER_MAX}
            placeholder="Boerboel cross"
            onChange={(e) => {
              const words = e.target.value;
              setTypedBreed(words);
              // Their words replace any earlier pick: two breeds on one plate is
              // not a state the plate can print.
              onTypeBreed(words);
            }}
            helperText={`This is printed on the plate exactly as you write it, up to ${OTHER_MAX} characters.`}
          />
          <p className="text-sm text-muted">
            {typedBreed.trim()
              ? `We will print ${typedBreed.trim()}. Their origin and group are left off, which the plate does neatly.`
              : "We will print whatever you write here."}
          </p>
          <button
            type="button"
            onClick={() => {
              setOwnWords(false);
              setTypedBreed("");
              onTypeBreed("");
            }}
            className="self-start text-sm text-accent underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base"
          >
            Search the list instead
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setOwnWords(true);
            // Log what they had typed when they gave up on the list. It is the
            // best signal we get for which breed to add next.
            if (typed) onMiss(typed);
          }}
          className="self-start text-sm text-accent underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base"
        >
          Can&apos;t find them? Write it yourself
        </button>
      )}
    </div>
  );
}
