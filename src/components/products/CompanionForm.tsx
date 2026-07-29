"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { BreedPicker } from "./BreedPicker";
import { cn } from "@/lib/cn";
import { TEMPERAMENTS, temperamentLabel, type Species } from "@/lib/breeds";
import {
  CUSTOM_FIELDS_MAX,
  CUSTOM_LABEL_MAX,
  CUSTOM_VALUE_MAX,
  EARLIEST_YEAR,
  NAME_MAX,
  TEMPERAMENT_COUNT,
  currentYear,
  hasTemperament,
  validateProfile,
  type CompanionProfile,
  type CustomField,
} from "@/lib/companion";

const SPECIES_OPTIONS: { value: Species; label: string }[] = [
  { value: "dog", label: "Dog" },
  { value: "cat", label: "Cat" },
  { value: "bird", label: "Bird" },
  { value: "reptile", label: "Reptile" },
  { value: "other", label: "Other" },
];

const chip =
  "rounded-md border px-4 py-2 text-sm font-medium transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-base";
const chipOn = "border-ink bg-ink text-base";
const chipOff = "border-line text-ink hover:bg-surface";

/**
 * Everything the plate knows about their animal, asked for before payment.
 *
 * The portrait is drawn after paying; this is the part that costs nothing and
 * carries most of the feeling, so it comes first (docs/spec-pipeline.md
 * section 3.2).
 *
 * @param checkName asks the server whether a name can actually be printed. Run
 * on blur rather than per keystroke: it reads the real font file, and the point
 * is to catch an unprintable character before payment, not within a keystroke.
 * @param onBreedMiss records a breed we do not carry yet.
 */
export function CompanionForm({
  profile,
  onChange,
  checkName,
  onBreedMiss,
}: {
  profile: CompanionProfile;
  onChange: (next: CompanionProfile) => void;
  checkName: (name: string) => Promise<{ ok: boolean; reason?: string }>;
  onBreedMiss: (query: string) => void;
}) {
  const [nameError, setNameError] = useState<string | null>(null);
  const errors = validateProfile(profile);

  const set = (patch: Partial<CompanionProfile>) =>
    onChange({ ...profile, ...patch });

  function chooseSpecies(species: Species) {
    // Breed and temperament belong to the species that was chosen, so changing
    // it clears them rather than carrying a spaniel over to a gecko.
    set({
      species,
      breedId: null,
      temperament: [],
      customFields: species === "other" ? profile.customFields : [],
    });
  }

  function toggleTemperament(word: (typeof TEMPERAMENTS)[number]) {
    const chosen = profile.temperament.includes(word)
      ? profile.temperament.filter((t) => t !== word)
      : [...profile.temperament, word];
    // Silently ignore a fourth rather than disabling the rest: a disabled chip
    // gives no clue why, and the counter below already says what is needed.
    if (chosen.length > TEMPERAMENT_COUNT) return;
    set({ temperament: chosen });
  }

  const customRows: CustomField[] = [
    ...profile.customFields,
    { label: "", value: "" },
  ].slice(0, CUSTOM_FIELDS_MAX);

  function setCustomRow(index: number, patch: Partial<CustomField>) {
    const rows = customRows.map((row, i) =>
      i === index ? { ...row, ...patch } : row,
    );
    set({ customFields: rows.filter((r) => r.label || r.value) });
  }

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <p className="font-block text-xs font-black uppercase tracking-[0.08em] text-accent">
          Their profile
        </p>
        <h2 className="font-display text-3xl leading-[1.1] text-ink">
          Introduce us to your best friend
        </h2>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium text-ink">
          What are they?
        </legend>
        <div className="flex flex-wrap gap-2">
          {SPECIES_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={profile.species === option.value}
              onClick={() => chooseSpecies(option.value)}
              className={cn(
                chip,
                profile.species === option.value ? chipOn : chipOff,
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      <Input
        label="Their name"
        maxLength={NAME_MAX}
        value={profile.name ?? ""}
        onChange={(e) => {
          setNameError(null);
          set({ name: e.target.value || null });
        }}
        onBlur={async (e) => {
          const result = await checkName(e.target.value);
          setNameError(result.ok ? null : (result.reason ?? null));
        }}
        helperText="Printed on both sides. Leave it blank and we simply leave it off."
        error={nameError ?? errors.name}
      />

      {profile.species === "other" ? (
        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-medium text-ink">
            Anything you would like on their plate
          </legend>
          <p className="text-sm text-muted">
            Up to {CUSTOM_FIELDS_MAX} details, in your own words.
          </p>
          {customRows.map((row, index) => (
            <div key={index} className="flex flex-wrap gap-3">
              <Input
                label={`Detail ${index + 1}`}
                placeholder="Rescued from"
                maxLength={CUSTOM_LABEL_MAX}
                value={row.label}
                onChange={(e) => setCustomRow(index, { label: e.target.value })}
                className="min-w-40"
              />
              <Input
                label={`Value ${index + 1}`}
                placeholder="A roadside in Knysna"
                maxLength={CUSTOM_VALUE_MAX}
                value={row.value}
                onChange={(e) => setCustomRow(index, { value: e.target.value })}
                className="min-w-52"
              />
            </div>
          ))}
        </fieldset>
      ) : (
        <BreedPicker
          species={profile.species}
          value={profile.breedId}
          onChange={(breed) => set({ breedId: breed.id })}
          onMiss={onBreedMiss}
        />
      )}

      {hasTemperament(profile.species) ? (
        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-medium text-ink">
            Three words for them
          </legend>
          <div className="flex flex-wrap gap-2">
            {TEMPERAMENTS.map((word) => {
              const on = profile.temperament.includes(word);
              return (
                <button
                  key={word}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleTemperament(word)}
                  className={cn(chip, on ? chipOn : chipOff)}
                >
                  {temperamentLabel(word)}
                </button>
              );
            })}
          </div>
          <p className="text-sm text-muted" role="status">
            {profile.temperament.length} of {TEMPERAMENT_COUNT} chosen
          </p>
        </fieldset>
      ) : null}

      <Input
        label="What year did they come into your life?"
        type="number"
        inputMode="numeric"
        min={EARLIEST_YEAR}
        max={currentYear()}
        placeholder="2021"
        value={profile.togetherSince ?? ""}
        onChange={(e) =>
          set({
            togetherSince: e.target.value ? Number(e.target.value) : null,
          })
        }
        helperText="Optional. We print the year you found each other, nothing else."
        error={errors.togetherSince}
      />
    </section>
  );
}
