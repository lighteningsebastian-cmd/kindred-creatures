"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { BreedPicker } from "./BreedPicker";
import { TEMPERAMENTS, temperamentLabel, type Species } from "@/lib/breeds";
import {
  EARLIEST_YEAR,
  NAME_MAX,
  OTHER_MAX,
  TEMPERAMENT_COUNT,
  currentYear,
  hasTemperament,
  validateProfile,
  type CompanionProfile,
} from "@/lib/companion";

const SPECIES_OPTIONS: { value: Species; label: string }[] = [
  { value: "dog", label: "Dog" },
  { value: "cat", label: "Cat" },
  { value: "bird", label: "Bird" },
  { value: "reptile", label: "Reptile" },
  { value: "other", label: "Other" },
];

/**
 * A selectable chip.
 *
 * It is a real {@link Button}: primary when on, which is the design system's
 * oxblood, and the hairline outline when off. Nothing bespoke. A chip with its
 * own colours was how this ended up near-black on a parchment page, which read
 * as a foreign object.
 */
function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant={on ? "primary" : "secondary"}
      size="sm"
      aria-pressed={on}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

/**
 * Everything the plate knows about their animal, asked for before payment.
 *
 * ORDER IS ABOUT MOMENTUM, not gating. The preview is on screen throughout, so
 * the name comes first because it appears on the plate as they type, and the
 * breed follows because choosing it fills in ORIGIN and GROUP on its own. That
 * autofill is the moment that sells the product.
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
    // Breed and the "other" answers belong to the species that was chosen, so
    // changing it clears them rather than carrying a spaniel over to a gecko.
    set({
      species,
      breedId: null,
      temperament: [],
      otherKind: null,
      otherBreed: null,
      otherOrigin: null,
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

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <p className="eyebrow text-xs text-accent">Their profile</p>
        <h2 className="font-display text-3xl leading-[1.1] text-ink">
          Introduce us to your best friend
        </h2>
      </div>

      {/* 1. The name. First, because it lands on the plate as they type. */}
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

      {/* 2. What they are. */}
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium text-ink">
          What are they?
        </legend>
        <div className="flex flex-wrap gap-2">
          {SPECIES_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              on={profile.species === option.value}
              onClick={() => chooseSpecies(option.value)}
            >
              {option.label}
            </Chip>
          ))}
        </div>
      </fieldset>

      {/* 3. Their breed, or the three named questions for anything else. */}
      {profile.species === "other" ? (
        <div className="flex flex-col gap-4">
          <Input
            label="What kind of animal are they?"
            placeholder="Horse"
            maxLength={OTHER_MAX}
            value={profile.otherKind ?? ""}
            onChange={(e) => set({ otherKind: e.target.value || null })}
            helperText="This is printed as their species."
            error={errors.otherKind}
          />
          <Input
            label="Breed or type, if they have one"
            placeholder="Nooitgedachter"
            maxLength={OTHER_MAX}
            value={profile.otherBreed ?? ""}
            onChange={(e) => set({ otherBreed: e.target.value || null })}
            helperText="Optional. Left off the plate if you skip it."
          />
          <Input
            label="Where are they from?"
            placeholder="The Karoo"
            maxLength={OTHER_MAX}
            value={profile.otherOrigin ?? ""}
            onChange={(e) => set({ otherOrigin: e.target.value || null })}
            helperText="Optional."
          />
        </div>
      ) : (
        <BreedPicker
          species={profile.species}
          value={profile.breedId}
          // Picking from the list and writing your own are the same answer
          // given two ways, so each clears the other. Two breeds is not a
          // state the plate can print.
          onChange={(breed) => set({ breedId: breed.id, otherBreed: null })}
          onMiss={onBreedMiss}
          typedBreedValue={profile.otherBreed}
          onTypeBreed={(words) =>
            set({ otherBreed: words || null, breedId: null })
          }
        />
      )}

      {/* 4. What they are like. */}
      {hasTemperament(profile.species) ? (
        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-medium text-ink">
            What are they like?
          </legend>
          <div className="flex flex-wrap gap-2">
            {TEMPERAMENTS.map((word) => (
              <Chip
                key={word}
                on={profile.temperament.includes(word)}
                onClick={() => toggleTemperament(word)}
              >
                {temperamentLabel(word)}
              </Chip>
            ))}
          </div>
          <p className="text-sm text-muted" role="status">
            {profile.temperament.length} of {TEMPERAMENT_COUNT} chosen
          </p>
        </fieldset>
      ) : null}

      {/* 5. The one date that will ever be on the plate. */}
      <Input
        label="When did they come into your life?"
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
        // Worded to work for a rescue, a purchase, or an animal that has died.
        // Never "birthday" alone, and never a full date: see
        // docs/spec-print-layout.md section 3 on why one date is the limit.
        helperText="Adoption day, gotcha day, or birthday. The year is enough, and it is optional."
        error={errors.togetherSince}
      />
    </section>
  );
}
