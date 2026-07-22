import { describe, it, expect } from "vitest";
import {
  REF_ALPHABET,
  generatePublicRef,
  generateUniquePublicRef,
  normalisePublicRef,
} from "./order-ref";

const FORMAT = /^KC-\d{4}-[A-Z2-9]{5}$/;

describe("generatePublicRef", () => {
  it("matches KC-YYMM-XXXXX with the shop's month", () => {
    // 2026-07 in UTC -> 2607.
    const ref = generatePublicRef(new Date("2026-07-22T10:00:00Z"));
    expect(ref).toMatch(FORMAT);
    expect(ref.startsWith("KC-2607-")).toBe(true);
  });

  it("zero-pads a single-digit month", () => {
    const ref = generatePublicRef(new Date("2026-01-05T00:00:00Z"));
    expect(ref.startsWith("KC-2601-")).toBe(true);
  });

  it("never uses a vowel or an ambiguous character", () => {
    // Every draw, across many refs, must stay inside the alphabet, which is the
    // whole point: no A/E/I/O/U (so no words), no L/0/1 (so no misreads).
    const forbidden = /[AEIOU L01]/;
    for (let i = 0; i < 500; i += 1) {
      const suffix = generatePublicRef().split("-")[2];
      expect(suffix).toMatch(/^[A-Z2-9]{5}$/);
      expect(forbidden.test(suffix)).toBe(false);
      for (const ch of suffix) expect(REF_ALPHABET).toContain(ch);
    }
  });

  it("draws a spread of characters, not one repeated value", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      for (const ch of generatePublicRef().split("-")[2]) seen.add(ch);
    }
    // A stuck generator would show a handful of characters; a real one shows most.
    expect(seen.size).toBeGreaterThan(REF_ALPHABET.length / 2);
  });
});

describe("generateUniquePublicRef", () => {
  it("retries past a collision and returns a free reference", async () => {
    let calls = 0;
    // Force the first two candidates to look taken, whatever they are, so the
    // retry loop is exercised deterministically rather than by luck.
    const exists = async () => {
      calls += 1;
      return calls <= 2;
    };
    const ref = await generateUniquePublicRef(exists);
    expect(ref).toMatch(FORMAT);
    expect(calls).toBe(3);
  });

  it("gives up after maxAttempts rather than looping forever", async () => {
    const alwaysTaken = async () => true;
    await expect(generateUniquePublicRef(alwaysTaken, new Date(), 3)).rejects.toThrow(
      /unique/i,
    );
  });
});

describe("normalisePublicRef", () => {
  it("upper-cases and re-hyphenates a lower-case spaced input", () => {
    expect(normalisePublicRef(" kc 2607 k4m9p ")).toBe("KC-2607-K4M9P");
  });

  it("tolerates a missing KC prefix", () => {
    expect(normalisePublicRef("2607-K4M9P")).toBe("KC-2607-K4M9P");
  });

  it("strips stray hyphens and punctuation", () => {
    expect(normalisePublicRef("KC--2607--K4M9P!")).toBe("KC-2607-K4M9P");
  });

  it("round-trips a freshly generated reference unchanged", () => {
    const ref = generatePublicRef(new Date("2026-07-22T10:00:00Z"));
    expect(normalisePublicRef(ref)).toBe(ref);
  });

  it("normalises nonsense to a non-matching string without throwing", () => {
    // A garbage input must not blow up; it just becomes something no order has.
    expect(normalisePublicRef("???")).toBe("KC-");
    expect(normalisePublicRef("")).toBe("KC-");
  });
});
