"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { BreedPicker } from "./BreedPicker";
import { cn } from "@/lib/cn";
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
import {
  afterBreed,
  afterName,
  afterTemperament,
  afterYear,
} from "@/lib/companion-copy";

const SPECIES_OPTIONS: { value: Species; label: string }[] = [
  { value: "dog", label: "Dog" },
  { value: "cat", label: "Cat" },
  { value: "bird", label: "Bird" },
  { value: "reptile", label: "Reptile" },
  { value: "other", label: "Other" },
];

/** A selectable chip. A real Button, so it inherits the design system. */
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

export type QuestionId = "name" | "species" | "breed" | "temperament" | "year";

/**
 * The profile, one question at a time.
 *
 * WHY ONE AT A TIME (docs/flow-review-2.md). The preview has to stay on screen
 * for the whole flow, and on a phone that leaves roughly 60vh for the form. Six
 * stacked fields cannot live in 60vh; one question comfortably can. So this is
 * not a stylistic choice about focus, it is what makes the promise of a live
 * preview physically possible on the device most people will use.
 *
 * Between questions the flow answers back using what was just given, which is
 * what makes it read as a conversation rather than a form. Those lines are
 * written by us and picked by rule (companion-copy.ts); nothing is generated and
 * no customer text goes anywhere near a model.
 *
 * Progress is dots, never "3 of 6". A counter makes it a form.
 */
export function ProfileQuestions({
  profile,
  onChange,
  checkName,
  onBreedMiss,
  onComplete,
}: {
  profile: CompanionProfile;
  onChange: (next: CompanionProfile) => void;
  checkName: (name: string) => Promise<{ ok: boolean; reason?: string }>;
  onBreedMiss: (query: string) => void;
  /** Called when the last question is answered and the reveal should follow. */
  onComplete: () => void;
}) {
  const [step, setStep] = useState(0);
  const [nameError, setNameError] = useState<string | null>(null);
  const errors = validateProfile(profile);

  const set = (patch: Partial<CompanionProfile>) =>
    onChange({ ...profile, ...patch });

  // Birds and reptiles skip temperament, so the run of questions is built from
  // the species rather than fixed: a counter would have been wrong anyway.
  const questions: QuestionId[] = [
    "name",
    "species",
    "breed",
    ...(hasTemperament(profile.species) ? (["temperament"] as const) : []),
    "year",
  ];
  const current = questions[Math.min(step, questions.length - 1)]!;
  const isLast = step >= questions.length - 1;

  function chooseSpecies(species: Species) {
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
    if (chosen.length > TEMPERAMENT_COUNT) return;
    set({ temperament: chosen });
  }

  /** Whether the question on screen has been answered well enough to move on. */
  const answered = (() => {
    switch (current) {
      case "name":
        return !nameError && !errors.name;
      case "species":
        return true;
      case "breed":
        return profile.species === "other"
          ? !errors.otherKind
          : !errors.breedId;
      case "temperament":
        return !errors.temperament;
      case "year":
        return !errors.togetherSince;
    }
  })();

  /** What the flow says back about the answer now on screen. */
  const reaction = (() => {
    switch (current) {
      case "name":
        return afterName(profile.name);
      case "breed":
        return profile.species === "other" ? null : afterBreed(profile.breedId);
      case "temperament":
        return afterTemperament(profile.temperament);
      case "year":
        return afterYear(profile.togetherSince);
      default:
        return null;
    }
  })();

  return (
    // A full-height column: the question scrolls if it must, the actions never
    // do. Next sliding off the bottom of a phone is the same class of bug as the
    // form being unreachable, just quieter.
    <section className="flex h-full min-h-0 flex-col gap-4">
      <div className="shrink-0 flex flex-col gap-2">
        <p className="eyebrow text-xs text-accent">Their profile</p>
        <h2 className="font-display text-2xl leading-[1.15] text-ink md:text-3xl">
          Introduce us to your best friend
        </h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {current === "name" ? (
          <Input
            label="What is their name?"
            maxLength={NAME_MAX}
            value={profile.name ?? ""}
            autoFocus
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
        ) : null}

        {current === "species" ? (
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
        ) : null}

        {current === "breed" ? (
          profile.species === "other" ? (
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
                helperText="Optional."
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
              onChange={(breed) => set({ breedId: breed.id })}
              onMiss={onBreedMiss}
            />
          )
        ) : null}

        {current === "temperament" ? (
          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-medium text-ink">
              What are they like? Choose three.
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
          </fieldset>
        ) : null}

        {current === "year" ? (
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
            helperText="Adoption day, gotcha day, or birthday. The year is enough, and it is optional."
            error={errors.togetherSince}
          />
        ) : null}
      </div>

      {/* The flow answering back. Written by us, chosen by rule. */}
      <p
        role="status"
        aria-live="polite"
        className="min-h-[1.5rem] shrink-0 text-sm leading-relaxed text-ink"
      >
        {reaction}
      </p>

      <div className="flex shrink-0 items-center justify-between gap-4 pb-1">
        <div className="flex items-center gap-3">
          {step > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              Back
            </Button>
          ) : null}
          <Button
            size="sm"
            disabled={!answered}
            onClick={() => (isLast ? onComplete() : setStep((s) => s + 1))}
          >
            {isLast ? "See their piece" : "Next"}
          </Button>
        </div>

        {/*
          Dots, never "3 of 6". A number turns a conversation into a form, and
          the run is not a fixed length anyway: a bird skips temperament.
        */}
        <div
          className="flex items-center gap-1.5"
          role="progressbar"
          aria-valuenow={step + 1}
          aria-valuemin={1}
          aria-valuemax={questions.length}
          aria-label="How far through the questions you are"
        >
          {questions.map((id, index) => (
            <span
              key={id}
              className={cn(
                "h-1.5 w-1.5 rounded-full transition-colors",
                index === step
                  ? "bg-accent"
                  : index < step
                    ? "bg-ink/40"
                    : "bg-line",
              )}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
