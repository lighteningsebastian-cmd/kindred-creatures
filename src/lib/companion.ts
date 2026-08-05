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
  /**
   * The breed in the customer's own words.
   *
   * TWO JOBS, ONE FIELD, because it is literally the same answer. For "other"
   * species it is the BREED row of the three named answers. For a dog or a cat
   * whose breed is not on our list, it is what they typed into "Can't find
   * them?", and it prints on the plate exactly as typed with ORIGIN and GROUP
   * omitted, because we know the words and not the pedigree.
   *
   * Printing what somebody typed is a decision with a cost: it is also how a
   * misspelling reaches a garment. It is taken knowingly (owner, 3 August)
   * because every job sheet is read by a person before anything is printed,
   * and being told "we have noted it" while your dog stays unnamed on the plate
   * is the worse outcome for the largest group of dog owners in the country.
   */
  otherBreed: string | null;
  otherOrigin: string | null;
}

export const NAME_MAX = 40;
/** Free text on a plate row. Long enough for "Somewhere near Colesberg". */
export const OTHER_MAX = 32;

/**
 * At least one word, up to three. Owner, 5 August.
 *
 * NAMED AS A MAXIMUM, not a count, and deliberately so: the old
 * `TEMPERAMENT_COUNT` read as a required number of words wherever it was used,
 * and the validation obligingly enforced it with a `!==`. A customer who could
 * only think of one true thing about their dog was refused until they padded
 * it out with a word they did not mean, which then got printed on a garment.
 */
export const TEMPERAMENT_MIN = 1;
export const TEMPERAMENT_MAX = 3;

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
    // A breed they typed themselves counts. It is the escape hatch for an
    // animal our list does not have, and it prints.
    const typed = profile.otherBreed?.trim();
    if (!typed) {
      errors.breedId = "Choose their breed, or tell us in your own words.";
    } else if (typed.length > OTHER_MAX) {
      errors.breedId = `Up to ${OTHER_MAX} characters, so it fits the plate.`;
    }
  }

  if (hasTemperament(profile.species)) {
    if (
      profile.temperament.length < TEMPERAMENT_MIN ||
      profile.temperament.length > TEMPERAMENT_MAX
    ) {
      errors.temperament = "Choose at least one word.";
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
