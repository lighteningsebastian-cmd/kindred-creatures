import { describe, it, expect } from "vitest";
import {
  afterBreed,
  afterName,
  afterTemperament,
  afterYear,
} from "./companion-copy";
import { TEMPERAMENTS, temperamentLabel, type Temperament } from "@/lib/breeds";

describe("what the flow says back", () => {
  it("uses the name, and says nothing without one", () => {
    expect(afterName("Fenn")).toContain("Fenn");
    expect(afterName(null)).toBeNull();
    expect(afterName("   ")).toBeNull();
  });

  it("shows it knows the breed rather than merely storing it", () => {
    const line = afterBreed("yorkshire-terrier")!;
    expect(line).toContain("Yorkshire Terrier");
    // The same fact the ORIGIN row is about to show, so the two agree.
    expect(line).toContain("Yorkshire, England");
  });

  it("never lets One of One read as a shrug", () => {
    const line = afterBreed("one-of-one-dog-large")!;
    expect(line).toMatch(/one of a kind/i);
    // And never the phrase the brand does not use.
    expect(line.toLowerCase()).not.toContain("mixed");
  });

  it("reads the combination, not the count", () => {
    const gentle = afterTemperament(["sleepy", "gentle", "wise"]);
    const wild = afterTemperament(["fearless", "mischievous", "spirited"]);

    expect(gentle).not.toBeNull();
    expect(wild).not.toBeNull();
    // A line that fits any three words tells the customer nobody listened.
    expect(gentle).not.toBe(wild);
  });

  it("says the words back, so it obviously read them", () => {
    const line = afterTemperament(["confident", "affectionate", "spirited"])!;
    expect(line).toContain("Confident");
    expect(line).toContain("affectionate");
    expect(line).toContain("spirited");
  });

  it("says nothing only when nothing has been chosen", () => {
    expect(afterTemperament([])).toBeNull();
  });

  // A customer may choose one word, so the person who chooses one must not get
  // silence where everybody else gets a warm line. That reads as the flow
  // telling them their answer was not good enough.
  it("builds the phrase for one, two and three words", () => {
    // The phrase is the opening of the line, so assert on how each STARTS: the
    // sentence that follows it has punctuation of its own.
    expect(afterTemperament(["confident"])).toMatch(/^Confident\./);
    expect(afterTemperament(["confident", "gentle"])).toMatch(
      /^Confident and gentle\./,
    );
    expect(afterTemperament(["confident", "gentle", "wise"])).toMatch(
      /^Confident, gentle and wise\./,
    );
  });

  it("has something to say for every single word we offer", () => {
    for (const word of TEMPERAMENTS) {
      const line = afterTemperament([word]);
      expect(line, word).toBeTruthy();
      expect(line, word).toContain(temperamentLabel(word));
    }
  });

  it("has something to say for every combination we offer", () => {
    // No silent gap: every triple lands on a line, and every line names them.
    for (const a of TEMPERAMENTS) {
      for (const b of TEMPERAMENTS) {
        if (a === b) continue;
        const trio: Temperament[] = [a, b, "loyal"];
        if (new Set(trio).size < 3) continue;
        const line = afterTemperament(trio);
        expect(line, `${a}+${b}`).toBeTruthy();
      }
    }
  });

  it("states the year and does no arithmetic on it", () => {
    const line = afterYear(2021)!;
    expect(line).toContain("2021");
    // Never "five years together": the reader may have had far fewer than they
    // expected, and this is the line most likely to land on a loss.
    expect(line).not.toMatch(/years/i);
    expect(afterYear(null)).toBeNull();
  });

  it("never speaks of the animal in the future tense", () => {
    const lines = [
      afterName("Fenn"),
      afterBreed("beagle"),
      afterTemperament(["confident", "gentle", "loyal"]),
      afterYear(2019),
    ].filter(Boolean) as string[];

    for (const line of lines) {
      expect(line).not.toMatch(/will (be|love|have)|years to come|can.?t wait/i);
    }
  });
});
