/**
 * The breed table behind the companion profile plate.
 *
 * WHY THIS IS DATA AND NOT AI. The customer picks a breed and the plate comes
 * back knowing its origin, group and binomial. That "how did it know" moment is
 * what makes the product feel expert, and it must be right every time, so it is
 * a lookup table rather than anything generated. A wrong origin printed on a
 * garment is not recoverable.
 *
 * THE BINOMIAL LIVES ON THE SPECIES, NOT THE BREED. Every dog is Canis lupus
 * familiaris and every cat is Felis catus, so those are stated once. Birds and
 * reptiles are genuinely different species, so they carry their own.
 *
 * NEVER THE CONVENTIONAL PHRASE. Where a breed is unrecorded or crossed, the
 * plate reads "One of One" and nothing else. This is deliberate: in a South
 * African context the usual wording carries connotations the brand must not
 * invoke, and "One of One" is better copy besides. It reads as status rather
 * than absence, which is the right thing to sit beside a catalogue number.
 * See docs/spec-print-layout.md section 3, whose verify step greps for the
 * banned phrase: do not reintroduce it here, not even to forbid it.
 *
 * GROWING THIS LIST. The customizer logs every unmatched breed search. Add from
 * that log, so the list grows by real demand rather than guesswork.
 */

export type Species = "dog" | "cat" | "bird" | "reptile" | "other";

export interface SpeciesConfig {
  /** Binomial shared by every breed of this species, if there is one. */
  binomial?: string;
  /** Label for the second data row: dogs have a GROUP, birds a NATIVE TO. */
  originLabel: string;
  /** Label for the third data row. Undefined means the row does not exist. */
  groupLabel?: string;
}

export const SPECIES: Record<Exclude<Species, "other">, SpeciesConfig> = {
  dog: {
    binomial: "Canis lupus familiaris",
    originLabel: "ORIGIN",
    groupLabel: "GROUP",
  },
  cat: {
    binomial: "Felis catus",
    originLabel: "ORIGIN",
    groupLabel: "COAT",
  },
  bird: { originLabel: "NATIVE TO" },
  reptile: { originLabel: "NATIVE RANGE" },
};

export interface Breed {
  id: string;
  name: string;
  species: Exclude<Species, "other">;
  /** Origin or native range. Printed against the species' originLabel. */
  origin: string;
  /** Breed group or coat. Omitted for birds and reptiles. */
  group?: string;
  /** Species binomial override. Birds and reptiles only. */
  binomial?: string;
  /**
   * True for the catch-all entries. These print "One of One" as the BREED value
   * and have no reference illustration, so the portrait is generated from the
   * customer's photograph alone.
   */
  oneOfOne?: boolean;
}

/** Storage key of the hand-reviewed side-profile reference for a breed. */
export function referenceKey(breed: Breed): string | null {
  return breed.oneOfOne ? null : `references/${breed.id}-profile.png`;
}

/** Storage key of the colour, face-on stock illustration used in the preview. */
export function stockKey(breed: Breed): string {
  return `references/${breed.id}-front.png`;
}

// ---------------------------------------------------------------------------
// Dogs. Ordered by South African ownership, not by American popularity lists:
// German Shepherd, Pit Bull and Rottweiler rank far higher here than abroad,
// and the Ridgeback and Boerboel are local.
// ---------------------------------------------------------------------------

const DOGS: Breed[] = [
  { id: "german-shepherd", name: "German Shepherd", species: "dog", origin: "Germany", group: "Herding" },
  { id: "labrador-retriever", name: "Labrador Retriever", species: "dog", origin: "Newfoundland, Canada", group: "Gundog" },
  { id: "rhodesian-ridgeback", name: "Rhodesian Ridgeback", species: "dog", origin: "Southern Africa", group: "Hound" },
  { id: "boerboel", name: "Boerboel", species: "dog", origin: "South Africa", group: "Working" },
  { id: "africanis", name: "Africanis", species: "dog", origin: "Southern Africa", group: "Landrace" },
  { id: "staffordshire-bull-terrier", name: "Staffordshire Bull Terrier", species: "dog", origin: "Staffordshire, England", group: "Terrier" },
  { id: "american-pit-bull-terrier", name: "American Pit Bull Terrier", species: "dog", origin: "United States", group: "Terrier" },
  { id: "jack-russell-terrier", name: "Jack Russell Terrier", species: "dog", origin: "Devon, England", group: "Terrier" },
  { id: "rottweiler", name: "Rottweiler", species: "dog", origin: "Rottweil, Germany", group: "Working" },
  { id: "maltese", name: "Maltese", species: "dog", origin: "Central Mediterranean", group: "Toy" },
  { id: "yorkshire-terrier", name: "Yorkshire Terrier", species: "dog", origin: "Yorkshire, England", group: "Toy Terrier" },
  { id: "border-collie", name: "Border Collie", species: "dog", origin: "Anglo-Scottish Border", group: "Herding" },
  { id: "golden-retriever", name: "Golden Retriever", species: "dog", origin: "Scotland", group: "Gundog" },
  { id: "dachshund", name: "Dachshund", species: "dog", origin: "Germany", group: "Hound" },
  { id: "pug", name: "Pug", species: "dog", origin: "China", group: "Toy" },
  { id: "french-bulldog", name: "French Bulldog", species: "dog", origin: "France", group: "Utility" },
  { id: "bulldog", name: "Bulldog", species: "dog", origin: "England", group: "Utility" },
  { id: "beagle", name: "Beagle", species: "dog", origin: "England", group: "Hound" },
  { id: "miniature-schnauzer", name: "Miniature Schnauzer", species: "dog", origin: "Germany", group: "Utility" },
  { id: "chihuahua", name: "Chihuahua", species: "dog", origin: "Chihuahua, Mexico", group: "Toy" },
  { id: "siberian-husky", name: "Siberian Husky", species: "dog", origin: "Siberia", group: "Working" },
  { id: "great-dane", name: "Great Dane", species: "dog", origin: "Germany", group: "Working" },
  { id: "boxer", name: "Boxer", species: "dog", origin: "Germany", group: "Working" },
  { id: "doberman", name: "Dobermann", species: "dog", origin: "Thuringia, Germany", group: "Working" },
  { id: "bullmastiff", name: "Bullmastiff", species: "dog", origin: "England", group: "Working" },
  { id: "bull-terrier", name: "Bull Terrier", species: "dog", origin: "England", group: "Terrier" },
  { id: "poodle", name: "Poodle", species: "dog", origin: "Germany", group: "Utility" },
  { id: "cocker-spaniel", name: "Cocker Spaniel", species: "dog", origin: "England", group: "Gundog" },
  { id: "weimaraner", name: "Weimaraner", species: "dog", origin: "Weimar, Germany", group: "Gundog" },
  { id: "basset-hound", name: "Basset Hound", species: "dog", origin: "France", group: "Hound" },
  { id: "australian-shepherd", name: "Australian Shepherd", species: "dog", origin: "United States", group: "Herding" },
  { id: "shih-tzu", name: "Shih Tzu", species: "dog", origin: "Tibet", group: "Toy" },

  // One of One. Three sizes so a rescue owner still gets a real preview.
  { id: "one-of-one-dog-small", name: "One of One · Small", species: "dog", origin: "Unrecorded", group: "One of One", oneOfOne: true },
  { id: "one-of-one-dog-medium", name: "One of One · Medium", species: "dog", origin: "Unrecorded", group: "One of One", oneOfOne: true },
  { id: "one-of-one-dog-large", name: "One of One · Large", species: "dog", origin: "Unrecorded", group: "One of One", oneOfOne: true },
];

// ---------------------------------------------------------------------------
// Cats. Most South African cats are moggies, so Domestic Shorthair and
// One of One will carry the majority of orders.
// ---------------------------------------------------------------------------

const CATS: Breed[] = [
  { id: "domestic-shorthair", name: "Domestic Shorthair", species: "cat", origin: "Worldwide", group: "Shorthair" },
  { id: "domestic-longhair", name: "Domestic Longhair", species: "cat", origin: "Worldwide", group: "Longhair" },
  { id: "siamese", name: "Siamese", species: "cat", origin: "Thailand", group: "Shorthair" },
  { id: "persian", name: "Persian", species: "cat", origin: "Iran", group: "Longhair" },
  { id: "ragdoll", name: "Ragdoll", species: "cat", origin: "California, United States", group: "Longhair" },
  { id: "british-shorthair", name: "British Shorthair", species: "cat", origin: "Britain", group: "Shorthair" },
  { id: "maine-coon", name: "Maine Coon", species: "cat", origin: "Maine, United States", group: "Longhair" },
  { id: "bengal", name: "Bengal", species: "cat", origin: "United States", group: "Shorthair" },
  { id: "sphynx", name: "Sphynx", species: "cat", origin: "Toronto, Canada", group: "Hairless" },
  { id: "abyssinian", name: "Abyssinian", species: "cat", origin: "Ethiopia", group: "Shorthair" },

  { id: "one-of-one-cat", name: "One of One", species: "cat", origin: "Unrecorded", group: "One of One", oneOfOne: true },
];

// ---------------------------------------------------------------------------
// Birds and reptiles. Each is a real species, so each carries its own binomial.
// ---------------------------------------------------------------------------

const BIRDS: Breed[] = [
  { id: "cockatiel", name: "Cockatiel", species: "bird", origin: "Australia", binomial: "Nymphicus hollandicus" },
  { id: "budgerigar", name: "Budgerigar", species: "bird", origin: "Australia", binomial: "Melopsittacus undulatus" },
  { id: "african-grey", name: "African Grey Parrot", species: "bird", origin: "Central Africa", binomial: "Psittacus erithacus" },
  { id: "lovebird", name: "Lovebird", species: "bird", origin: "Southern Africa", binomial: "Agapornis roseicollis" },
  { id: "canary", name: "Canary", species: "bird", origin: "Canary Islands", binomial: "Serinus canaria" },
  { id: "cockatoo", name: "Cockatoo", species: "bird", origin: "Australia", binomial: "Cacatua galerita" },
  { id: "conure", name: "Conure", species: "bird", origin: "South America", binomial: "Pyrrhura molinae" },
];

const REPTILES: Breed[] = [
  { id: "bearded-dragon", name: "Bearded Dragon", species: "reptile", origin: "Australia", binomial: "Pogona vitticeps" },
  { id: "leopard-gecko", name: "Leopard Gecko", species: "reptile", origin: "Central Asia", binomial: "Eublepharis macularius" },
  { id: "crested-gecko", name: "Crested Gecko", species: "reptile", origin: "New Caledonia", binomial: "Correlophus ciliatus" },
  { id: "ball-python", name: "Ball Python", species: "reptile", origin: "West Africa", binomial: "Python regius" },
  { id: "corn-snake", name: "Corn Snake", species: "reptile", origin: "United States", binomial: "Pantherophis guttatus" },
  { id: "leopard-tortoise", name: "Leopard Tortoise", species: "reptile", origin: "Southern Africa", binomial: "Stigmochelys pardalis" },
];

export const BREEDS: Breed[] = [...DOGS, ...CATS, ...BIRDS, ...REPTILES];

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

export function getBreed(id: string): Breed | undefined {
  return BREEDS.find((b) => b.id === id);
}

export function breedsForSpecies(species: Species): Breed[] {
  if (species === "other") return [];
  return BREEDS.filter((b) => b.species === species);
}

/** The binomial to print: the breed's own, else the species default. */
export function binomialFor(breed: Breed): string | undefined {
  return breed.binomial ?? SPECIES[breed.species].binomial;
}

/** The value printed in the BREED row. "One of One", or the breed's own name. */
export function breedRowValue(breed: Breed): string {
  return breed.oneOfOne ? "One of One" : breed.name;
}

/** Lowercase, strip accents, so "Dobermann" and "dobermann" both match. */
function fold(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * How well a breed name matches a query. Lower is better, null is no match.
 *
 * WHY THIS IS RANKED AND NOT A SUBSTRING TEST. A plain `includes` puts
 * "Labrador Retriever" at the top when someone types "b", because there is a b
 * in the middle of "Labrador". That is baffling to use. A person typing into a
 * breed field is typing the START of a word, so a name beginning with the query
 * must outrank a name that merely contains it, and a match on any word start
 * ("collie" finding "Border Collie") must outrank a match mid-word.
 */
function matchRank(name: string, needle: string): number | null {
  const n = fold(name);
  if (n === needle) return 0; // exact
  if (n.startsWith(needle)) return 1; // "lab" -> Labrador Retriever
  if (n.split(/[\s-]+/).some((w) => w.startsWith(needle))) return 2; // "collie" -> Border Collie
  if (n.includes(needle)) return 3; // last resort, mid-word
  return null;
}

/**
 * How many results to offer before the customer has typed anything. The full
 * list of 35 dogs is a wall, not a menu.
 */
export const PICKER_PREVIEW = 6;

/** The most commonly owned first, so the pre-typing list is genuinely useful. */
export function popularBreeds(species: Species): Breed[] {
  return breedsForSpecies(species)
    .filter((b) => !b.oneOfOne)
    .slice(0, PICKER_PREVIEW);
}

/**
 * Ranked, accent insensitive search for the picker.
 *
 * An empty query returns the popular shortlist rather than everything. A miss
 * should be logged by the caller so the list grows by real demand.
 */
export function searchBreeds(species: Species, query: string): Breed[] {
  const needle = fold(query);
  if (needle === "") return popularBreeds(species);

  return breedsForSpecies(species)
    .map((breed, index) => ({ breed, rank: matchRank(breed.name, needle), index }))
    .filter((r): r is { breed: Breed; rank: number; index: number } => r.rank !== null)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((r) => r.breed);
}

/**
 * Temperament chips. The customer picks exactly three for a dog or a cat and
 * they print, joined by a middot, in the TEMPERAMENT row.
 *
 * A closed set, not free text, because these are validated before they can
 * reach a prompt (docs/spec-pipeline.md section 6) and because three words
 * chosen from twelve read better on a plate than three typed by hand.
 */
export const TEMPERAMENTS = [
  "confident",
  "affectionate",
  "spirited",
  "gentle",
  "loyal",
  "playful",
  "watchful",
  "fearless",
  "sleepy",
  "wise",
  "mischievous",
  "devoted",
] as const;

export type Temperament = (typeof TEMPERAMENTS)[number];

export function isTemperament(value: unknown): value is Temperament {
  return (
    typeof value === "string" && (TEMPERAMENTS as readonly string[]).includes(value)
  );
}

/** Title case for the plate: "confident" prints as "Confident". */
export function temperamentLabel(value: Temperament): string {
  return value[0]!.toUpperCase() + value.slice(1);
}
