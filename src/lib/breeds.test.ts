import { describe, it, expect } from "vitest";
import {
  BREEDS,
  breedRowValue,
  breedsForSpecies,
  getBreed,
  popularBreeds,
  referenceKey,
  searchBreeds,
} from "./breeds";

/**
 * The One of One entries, which are the commonest case in South Africa and the
 * one the brand is most careful about.
 */
describe("One of One", () => {
  const COLOURS = ["brown", "black", "white", "brindle", "spotty"] as const;

  it("is five colours for dogs and the same five for cats", () => {
    for (const species of ["dog", "cat"] as const) {
      const ids = breedsForSpecies(species)
        .filter((b) => b.oneOfOne)
        .map((b) => b.id);
      expect(ids, species).toEqual(
        COLOURS.map((c) => `one-of-one-${species}-${c}`),
      );
    }
  });

  it("names the colour so the customer can tell them apart", () => {
    expect(getBreed("one-of-one-dog-brindle")?.name).toBe("One of One · Brindle");
    expect(getBreed("one-of-one-cat-spotty")?.name).toBe("One of One · Spotty");
  });

  // THE COLOUR IS NOT PRINTED. It selects which stock reference illustration
  // the back portrait is given, and nothing else. Every one of these prints
  // the same three words, so the plate cannot leak the choice.
  it("prints the same three words whichever colour was chosen", () => {
    for (const breed of BREEDS.filter((b) => b.oneOfOne)) {
      expect(breedRowValue(breed), breed.id).toBe("One of One");
    }
  });

  it("keeps the catalogue fields every One of One carried before", () => {
    for (const breed of BREEDS.filter((b) => b.oneOfOne)) {
      expect(breed.origin, breed.id).toBe("Unrecorded");
      expect(breed.group, breed.id).toBe("One of One");
      expect(breed.aliases, breed.id).toContain("pavement special");
    }
  });

  // The colour library does not exist yet, so these generate from the
  // customer's photograph alone. That is correct and must not be faked with a
  // neighbouring breed's reference: it would put a stranger's dog in the input.
  it("has no reference illustration, and does not pretend to", () => {
    for (const breed of BREEDS.filter((b) => b.oneOfOne)) {
      expect(referenceKey(breed), breed.id).toBeNull();
    }
  });

  it("is reachable by what South Africans actually call these dogs", () => {
    for (const query of ["pavement special", "brak", "rescue", "spca"]) {
      const [first] = searchBreeds("dog", query);
      expect(first?.oneOfOne, query).toBe(true);
    }
  });

  it("is reachable by colour, because the colour is in the name", () => {
    const [first] = searchBreeds("dog", "brindle");
    expect(first?.id).toBe("one-of-one-dog-brindle");
  });

  // The pre-typing shortlist is the popular pedigrees. Five identical-looking
  // One of One rows at the top of it would be a worse first impression than
  // the list they replace.
  it("stays out of the shortlist shown before anything is typed", () => {
    for (const species of ["dog", "cat"] as const) {
      expect(popularBreeds(species).some((b) => b.oneOfOne)).toBe(false);
    }
  });

  it("never carries the phrase the brand does not use", () => {
    // Aliases route that word IN so a customer typing it finds something. It
    // must never come back OUT as a name or a printed value.
    for (const breed of BREEDS.filter((b) => b.oneOfOne)) {
      expect(breed.name.toLowerCase()).not.toContain("mixed");
      expect(breedRowValue(breed).toLowerCase()).not.toContain("mixed");
    }
  });
});

describe("the breed table", () => {
  it("has no duplicate ids", () => {
    const ids = BREEDS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
