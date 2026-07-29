import { describe, expect, it } from "vitest";
import { loadPrintFont, type PrintFontRole } from "./fonts";

const ROLES: PrintFontRole[] = [
  "wordmark",
  "label",
  "value",
  "breed",
  "binomial",
  "frontName",
  "backName",
];

describe("loadPrintFont", () => {
  it.each(ROLES)("loads a real, outline-bearing font for %s", (role) => {
    const font = loadPrintFont(role);

    expect(font.unitsPerEm).toBeGreaterThan(0);
    // A font that parsed but carries no outlines would rasterise as nothing at
    // all, which on a garment is an unprinted plate rather than a visible error.
    const path = font.charToGlyph("K").getPath(0, 0, 72);
    expect(path.commands.length).toBeGreaterThan(0);
  });

  it("covers the accented glyphs a pet name can actually contain", () => {
    // The reason the fonts are vendored whole instead of taken from next/font,
    // which subsets to whatever the website happened to render.
    const font = loadPrintFont("frontName");
    for (const char of ["ë", "é", "ô", "ü", "ç"]) {
      const glyph = font.charToGlyph(char);
      expect(glyph.getPath(0, 0, 72).commands.length).toBeGreaterThan(0);
    }
  });

  it("returns the same parsed instance rather than reparsing", () => {
    expect(loadPrintFont("value")).toBe(loadPrintFont("value"));
  });

  it("sets the binomial in an italic face", () => {
    // The binomial is the one italic on the plate and Young Serif has no italic
    // cut, which is why a third family is vendored at all. If this role ever
    // points at an upright face, that decision has been silently undone.
    const font = loadPrintFont("binomial");
    expect(font.tables.post.italicAngle).not.toBe(0);
  });
});
