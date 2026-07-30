import { isTemperament, type Species, type Temperament } from "@/lib/breeds";

/**
 * Everything the customer tells us about their animal, which is everything the
 * plate prints apart from the portrait itself (docs/spec-pipeline.md section
 * 3.2). Collected before payment; the portrait is drawn after.
 *
 * Almost all of it is optional because the plate omits any row it has no value
 * for. A four row plate has to look as deliberate as a five row one, so a blank
 * is never printed and never defaulted to something printable.
 */
export interface CompanionProfile {
  /** Printed both sides. Sentence case on the front, caps on the back. */
  name: string | null;
  species: Species;
  /** Null for "other", which has no breed list. */
  breedId: string | null;
  /** Exactly three, dogs and cats only. */
  temperament: Temperament[];
  /**
   * The year they arrived, and there is no companion field for a year they
   * left. One date is a founding date; two is a lifespan. See
   * docs/spec-print-layout.md section 3.
   */
  togetherSince: number | null;
  /**
   * "other" species only: three NAMED answers, not a key/value grid.
   *
   * The earlier spec asked for "label and value pairs", which produced a form
   * that asked a customer with a horse to invent a field name. These map
   * straight onto plate rows instead: SPECIES, BREED, ORIGIN.
   */
  otherKind: string | null;
  otherBreed: string | null;
  otherOrigin: string | null;
}

export const NAME_MAX = 40;
/** Free text on a plate row. Long enough for "Somewhere near Colesberg". */
export const OTHER_MAX = 32;
export const TEMPERAMENT_COUNT = 3;

/** Nothing alive today arrived before this, and typos are usually decades out. */
export const EARLIEST_YEAR = 1950;

export function currentYear(): number {
  return new Date().getFullYear();
}

/**
 * Species that carry temperament chips.
 *
 * Birds and reptiles do not: three personality words for a gecko would be us
 * putting words in somebody's mouth. "Other" DOES, because a horse or a donkey
 * has as much character as any dog and the owner asked for it explicitly.
 */
export function hasTemperament(species: Species): boolean {
  return species === "dog" || species === "cat" || species === "other";
}

export function emptyProfile(species: Species = "dog"): CompanionProfile {
  return {
    name: null,
    species,
    breedId: null,
    temperament: [],
    togetherSince: null,
    otherKind: null,
    otherBreed: null,
    otherOrigin: null,
  };
}

/**
 * What still stops this profile being printable, keyed by field.
 *
 * Returns an empty object when the profile is good to go. This runs on the
 * client for live feedback and again on the server before anything is charged
 * for, because a browser is not a trust boundary.
 *
 * It deliberately does NOT check whether the name's characters can be printed:
 * that answer lives in the font files and is a server round trip
 * (checkCreatureName), so it is not duplicated here as a regex that would drift
 * out of step with the fonts we actually ship.
 */
export function validateProfile(
  profile: CompanionProfile,
): Partial<Record<keyof CompanionProfile, string>> {
  const errors: Partial<Record<keyof CompanionProfile, string>> = {};

  if (profile.name !== null && profile.name.length > NAME_MAX) {
    errors.name = `Names can be up to ${NAME_MAX} characters.`;
  }

  if (profile.species === "other") {
    // What kind of animal they are is the only thing we insist on: it takes the
    // SPECIES row, and a plate for an unnamed sort of creature says nothing.
    if (!profile.otherKind?.trim()) {
      errors.otherKind = "Tell us what kind of animal they are.";
    } else if (
      [profile.otherKind, profile.otherBreed, profile.otherOrigin].some(
        (value) => (value?.length ?? 0) > OTHER_MAX,
      )
    ) {
      errors.otherKind = `Up to ${OTHER_MAX} characters each, so it fits the plate.`;
    }
  } else if (!profile.breedId) {
    errors.breedId = "Choose their breed, or One of One.";
  }

  if (hasTemperament(profile.species)) {
    if (profile.temperament.length !== TEMPERAMENT_COUNT) {
      errors.temperament = `Choose ${TEMPERAMENT_COUNT} words.`;
    } else if (!profile.temperament.every(isTemperament)) {
      // Only ever reachable by a tampered payload: chips are a closed set, and
      // they are the only customer input allowed anywhere near a prompt.
      errors.temperament = "That is not one of the words on offer.";
    }
  }

  const year = profile.togetherSince;
  if (year !== null && (year < EARLIEST_YEAR || year > currentYear())) {
    errors.togetherSince = `Use a year between ${EARLIEST_YEAR} and ${currentYear()}.`;
  }

  return errors;
}

export function isProfileComplete(profile: CompanionProfile): boolean {
  return Object.keys(validateProfile(profile)).length === 0;
}

/**
 * The line that sits under every preview, always, in plain sight.
 *
 * The preview shows a real plate carrying their own data, but a STOCK
 * illustration of the breed: their animal has not been drawn yet, and the
 * breed library is house style only, so somebody who picked watercolour is
 * still looking at a house-style example. Saying so is the difference between
 * a clever preview and a complaint, and it promises something better than what
 * they are looking at rather than less.
 *
 * Never collapse this behind a tooltip and never let it depend on a network
 * call: it has to be on screen whenever a stock illustration is.
 */
export function stockDisclosure(breedName: string | null): string {
  const tail =
    "Yours will be drawn from your own photo, in the style you choose.";
  if (!breedName) return `The illustration shown is an example. ${tail}`;
  const article = /^[AEIOU]/i.test(breedName) ? "an" : "a";
  return `The illustration shown is ${article} ${breedName} example. ${tail}`;
}
