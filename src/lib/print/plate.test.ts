// @vitest-environment node
import { describe, it, expect } from "vitest";
import sharp from "sharp";
import {
  backPlate,
  composePlate,
  frontPlate,
  plateHeading,
  tableRows,
} from "./plate";
import { outlineText } from "./text-to-path";
import { emptyProfile, type CompanionProfile } from "@/lib/companion";

const W = 900;
const H = 1125;

function profile(over: Partial<CompanionProfile> = {}): CompanionProfile {
  return {
    ...emptyProfile("dog"),
    name: "Francis",
    breedId: "yorkshire-terrier",
    temperament: ["confident", "affectionate", "spirited"],
    togetherSince: 2021,
    ...over,
  };
}

/**
 * The leftmost and rightmost x any drawn path reaches, in PLATE coordinates.
 *
 * Runs that are positioned rather than baked sit inside a `<g transform>`, and
 * their path data is relative to that translate. Reading the raw numbers out of
 * the whole document therefore measures glyph-local coordinates and answers a
 * question nobody asked; the translate has to be added back.
 */
function drawnXRange(svg: string): { min: number; max: number } {
  const xsIn = (s: string) =>
    [...s.matchAll(/[ML](-?\d+(?:\.\d+)?) /g)].map((m) => Number(m[1]));

  const xs = xsIn(svg.replace(/<g transform.*?<\/g>/gs, ""));
  for (const g of svg.matchAll(
    /<g transform="translate\(([-\d.]+) [-\d.]+\)">(.*?)<\/g>/gs,
  )) {
    const dx = Number(g[1]);
    xs.push(...xsIn(g[2]!).map((x) => x + dx));
  }
  return { min: Math.min(...xs), max: Math.max(...xs) };
}

describe("plate type layer", () => {
  it("is outlines and nothing a rasteriser must find a font for", () => {
    for (const svg of [
      backPlate(profile(), "KC-01248", W, H).svg,
      frontPlate(profile(), 600, 600).svg,
    ]) {
      expect(svg).not.toContain("<text");
      expect(svg).not.toMatch(/font-family/i);
      expect(svg).toContain("<path");
      // No backing rectangle: the plate prints onto the garment colour itself.
      expect(svg).not.toContain("<rect");
    }
  });
});

describe("the heading above the portrait", () => {
  // The breed word is printed here and nowhere else now, so every route to one
  // has to arrive. A plate whose heading fell back to COMPANION PROFILE while
  // the customer told us their dog is a Boerboel cross has lost the answer.
  it("is the breed, in caps", () => {
    expect(plateHeading(profile())).toBe("YORKSHIRE TERRIER");
  });

  it("is One of One for an unrecorded breed", () => {
    expect(plateHeading(profile({ breedId: "one-of-one-dog-brown" }))).toBe(
      "ONE OF ONE",
    );
  });

  it("is their own words when our list did not have them", () => {
    expect(
      plateHeading(profile({ breedId: null, otherBreed: "Boerboel cross" })),
    ).toBe("BOERBOEL CROSS");
  });

  it("is an other species' own breed word, not COMPANION PROFILE", () => {
    expect(
      plateHeading(
        profile({
          species: "other",
          breedId: null,
          otherKind: "Horse",
          otherBreed: "Nooitgedachter",
        }),
      ),
    ).toBe("NOOITGEDACHTER");
  });

  it("falls back only when there is no breed word at all", () => {
    expect(
      plateHeading(
        profile({ species: "other", breedId: null, otherKind: "Donkey" }),
      ),
    ).toBe("COMPANION PROFILE");
  });

  it("prefers the chosen breed when somehow both are set", () => {
    // The picker clears one when the other is given, so this is only reachable
    // by a tampered payload. A real breed beats free text.
    expect(
      plateHeading(
        profile({ breedId: "yorkshire-terrier", otherBreed: "Nonsense" }),
      ),
    ).toBe("YORKSHIRE TERRIER");
  });
});

describe("the data table", () => {
  it("is three rows at most, and closes up rather than printing a blank", () => {
    // ORIGIN, GROUP, TOGETHER. Owner, 5 August: anything more is too busy.
    const full = tableRows(profile());
    expect(full.map((r) => r.label)).toEqual(["ORIGIN", "GROUP", "TOGETHER"]);

    const sparse = tableRows(profile({ temperament: [], togetherSince: null }));
    expect(sparse.map((r) => r.label)).toEqual(["ORIGIN", "GROUP"]);
    expect(sparse.every((r) => r.value.trim() !== "")).toBe(true);
  });

  it("never prints the breed, which is the heading above the portrait", () => {
    // Once is a fact, twice is a fault. The word moved up to the heading.
    for (const p of [
      profile(),
      profile({ breedId: "one-of-one-dog-brown" }),
      profile({ breedId: null, otherBreed: "Boerboel cross" }),
    ]) {
      expect(tableRows(p).map((r) => r.label)).not.toContain("BREED");
    }
  });

  it("never prints the temperament, which sits under the portrait", () => {
    expect(tableRows(profile()).map((r) => r.label)).not.toContain(
      "TEMPERAMENT",
    );
  });

  it("keeps One of One off the table entirely", () => {
    const rows = tableRows(profile({ breedId: "one-of-one-dog-brown" }));
    // ORIGIN is Unrecorded; GROUP is suppressed because it repeats the heading.
    expect(rows.map((r) => r.label)).toEqual(["ORIGIN", "TOGETHER"]);
    expect(rows.filter((r) => r.value === "One of One")).toHaveLength(0);
    // The phrase it replaces must appear nowhere, in any casing.
    expect(JSON.stringify(rows).toLowerCase()).not.toContain("mixed");
  });

  it("adds no row at all for a breed the customer wrote themselves", () => {
    // The escape hatch for a dog our list does not have. Their words go on the
    // plate as written (owner decision, 3 August), as the HEADING; ORIGIN and
    // GROUP are simply left off, because we know what they call their dog and
    // not where the line came from. Inventing either would be the one dishonest
    // row on an honest plate.
    const rows = tableRows(
      profile({ breedId: null, otherBreed: "Boerboel cross" }),
    );
    expect(rows.map((r) => r.label)).toEqual(["TOGETHER"]);
  });

  it("comes back empty when the heading is the only thing we were told", () => {
    // A typed breed and no year leaves nothing for a row. That is a real state
    // and the plate has to carry it: the rule above and the name below do.
    const rows = tableRows(
      profile({ breedId: null, otherBreed: "Boerboel cross", togetherSince: null }),
    );
    expect(rows).toEqual([]);
  });

  it("labels rows by species, not by dog", () => {
    const cat = tableRows(
      profile({ species: "cat", breedId: "ragdoll", temperament: [] }),
    );
    // Cats have a COAT where dogs have a GROUP.
    expect(cat.map((r) => r.label)).toContain("COAT");
    expect(cat.map((r) => r.label)).not.toContain("GROUP");
    expect(cat.find((r) => r.label === "COAT")?.value).toBe("Longhair");
  });

  it("gives other species two NAMED rows, not invented ones", () => {
    // The earlier key/value grid asked a customer with a horse to make up a
    // field name. SPECIES and ORIGIN are the same rows every species gets;
    // their word for the breed is the heading, as it is for a dog.
    const rows = tableRows(
      profile({
        species: "other",
        breedId: null,
        temperament: [],
        otherKind: "Horse",
        otherBreed: "Nooitgedachter",
        otherOrigin: "The Karoo",
      }),
    );
    expect(rows.map((r) => r.label)).toEqual([
      "SPECIES",
      "ORIGIN",
      "TOGETHER",
    ]);
    expect(rows.find((r) => r.label === "SPECIES")?.value).toBe("Horse");
    expect(JSON.stringify(rows)).not.toContain("Nooitgedachter");
  });

  it("omits the optional other-species rows when they are blank", () => {
    const rows = tableRows(
      profile({
        species: "other",
        breedId: null,
        temperament: [],
        togetherSince: null,
        otherKind: "Donkey",
        otherBreed: null,
        otherOrigin: "   ",
      }),
    );
    // The table closes up, exactly as it does for a dog with no year.
    expect(rows.map((r) => r.label)).toEqual(["SPECIES"]);
  });

  it("puts the only date in the table and never under the name", () => {
    // Name above a year is a headstone; name above a catalogue number is an
    // archive entry. docs/spec-print-layout.md section 3.
    const rows = tableRows(profile());
    const dates = rows.filter((r) => /^\d{4}$/.test(r.value));
    expect(dates).toHaveLength(1);
    expect(dates[0]!.label).toBe("TOGETHER");
    // Whatever the label is, it must never read as a lifespan.
    for (const banned of ["EST.", "BORN", "LIFE"]) {
      expect(rows.map((r) => r.label)).not.toContain(banned);
    }
  });
});

describe("back plate layout", () => {
  it("keeps the longest breed clear of the value column", () => {
    // The spec's own worst case: a long name and a long origin on one plate.
    const margin = W * 0.08;
    const contentWidth = W - margin * 2;
    const rowSize = contentWidth * 0.038;

    for (const row of tableRows(
      profile({ breedId: "staffordshire-bull-terrier" }),
    )) {
      const label = outlineText(row.label, {
        role: "label",
        sizePx: rowSize,
        letterSpacingPx: rowSize * 0.16,
      });
      const value = outlineText(row.value, { role: "value", sizePx: rowSize });
      // A gutter, not merely "not overlapping": type that touches reads as broken.
      expect(label.width + value.width).toBeLessThan(contentWidth * 0.94);
    }
  });

  it("keeps the longest breed name inside the plate", () => {
    // Caught by /dev/mockups: "STAFFORDSHIRE BULL TERRIER" ran off both edges of
    // the plate and the press would simply have clipped it. Nobody sees that
    // until the garment arrives.
    const margin = W * 0.08;

    for (const breedId of [
      "staffordshire-bull-terrier",
      "american-pit-bull-terrier",
      "yorkshire-terrier",
      "pug",
    ]) {
      const svg = backPlate(profile({ breedId }), "KC-01248", W, H).svg;
      // Every drawn path stays within the plate's content column, measured in
      // plate coordinates rather than glyph-local ones.
      const { min, max } = drawnXRange(svg);
      expect(max, breedId).toBeLessThanOrEqual(W - margin + 1);
      expect(min, breedId).toBeGreaterThanOrEqual(margin - 1);
    }
  });

  it("leaves the portrait a real box inside the plate", () => {
    const { portrait } = backPlate(profile(), "KC-01248", W, H);
    expect(portrait.width).toBeGreaterThan(0);
    expect(portrait.height).toBeGreaterThan(0);
    expect(portrait.x).toBeGreaterThanOrEqual(0);
    expect(portrait.y + portrait.height).toBeLessThanOrEqual(H);
  });

  it("gives the portrait more room when the table is short", () => {
    const full = backPlate(profile(), "KC-01248", W, H).portrait.height;
    const sparse = backPlate(
      profile({ temperament: [], togetherSince: null }),
      "KC-01248",
      W,
      H,
    ).portrait.height;
    expect(sparse).toBeGreaterThan(full);
  });

  // The temperament line moved out of the table and under the portrait on
  // 5 August. It has to take its space from the PORTRAIT and from nothing else,
  // or it lands on the rule, on the table, or on the animal.
  describe("the temperament under the portrait", () => {
    const rowSize = (W - W * 0.08 * 2) * 0.038;

    it("costs the portrait exactly the height of the line", () => {
      const none = backPlate(profile({ temperament: [] }), null, W, H).portrait;
      const three = backPlate(profile(), null, W, H).portrait;

      // The line is set at the table's row size, so the portrait loses roughly
      // one line of it. Bounded on both sides: unchanged would mean the line is
      // overlapping the portrait, and a large loss would mean it is claiming
      // space it does not use.
      const lost = none.height - three.height;
      expect(lost).toBeGreaterThan(rowSize * 0.5);
      expect(lost).toBeLessThan(rowSize * 3);
    });

    it("costs the same whether one word was chosen or three", () => {
      // One word is a shorter line, not a shorter one. The rule must sit the
      // same distance below it either way.
      const one = backPlate(
        profile({ temperament: ["gentle"] }),
        null,
        W,
        H,
      ).portrait;
      const three = backPlate(profile(), null, W, H).portrait;
      expect(one.height).toBeCloseTo(three.height, 5);
    });

    it("takes no space at all when no words were chosen", () => {
      // No line AND no gap: the portrait grows back into it. Same discipline
      // as the name and the year.
      const none = backPlate(profile({ temperament: [] }), null, W, H);
      const three = backPlate(profile(), null, W, H);
      expect(none.svg.length).toBeLessThan(three.svg.length);
      expect(none.portrait.height).toBeGreaterThan(three.portrait.height);
    });

    it("leaves the portrait a real box even with a long line", () => {
      const long = backPlate(
        profile({ temperament: ["affectionate", "mischievous", "affectionate"] }),
        "KC-01248",
        W,
        H,
      );
      expect(long.portrait.height).toBeGreaterThan(0);
      expect(long.portrait.y + long.portrait.height).toBeLessThanOrEqual(H);
    });
  });

  it("omits the reference when there is none", () => {
    const withRef = backPlate(profile(), "KC-01248", W, H).svg;
    const without = backPlate(profile(), null, W, H).svg;
    expect(without.length).toBeLessThan(withRef.length);
  });
});

describe("front plate layout", () => {
  it("keeps the name whole inside the plate", () => {
    // Including its descenders: a tail clipped by the print edge is not
    // something anyone notices until it is on a garment.
    const name = outlineText("JETTY", { role: "frontName", sizePx: 600 * 0.115 });
    const { portrait } = frontPlate(profile({ name: "Jetty" }), 600, 600);
    expect(portrait.y + portrait.height + name.ascent + name.descent).toBeLessThanOrEqual(600);
  });

  // ALL CAPS, matching the back. Owner decision, 3 August; the spec has said so
  // since and only the code had not followed.
  it("sets the name in caps however it was typed", () => {
    const typed = frontPlate(profile({ name: "Francis" }), 600, 600).svg;
    const shouted = frontPlate(profile({ name: "FRANCIS" }), 600, 600).svg;
    expect(typed).toBe(shouted);
  });

  // Caps are meaningfully wider than sentence case, and the front name was not
  // being shrunk to fit at all. BARTHOLOMEW on a 110mm print is the case.
  it("shrinks a long name to fit rather than running off the plate", () => {
    const W_FRONT = 1299; // 110mm at 300 DPI
    const H_FRONT = 1772; // 150mm at 300 DPI
    const margin = W_FRONT * 0.06;

    for (const name of ["BARTHOLOMEW", "Bartholomew", "Constantinopoulos"]) {
      const { min, max } = drawnXRange(
        frontPlate(profile({ name }), W_FRONT, H_FRONT).svg,
      );
      expect(max, name).toBeLessThanOrEqual(W_FRONT - margin + 1);
      expect(min, name).toBeGreaterThanOrEqual(margin - 1);
    }
  });

  it("recentres on the portrait when there is no name", () => {
    const named = frontPlate(profile(), 600, 600).portrait;
    const unnamed = frontPlate(profile({ name: null }), 600, 600).portrait;

    // The freed space goes to the portrait rather than leaving a gap.
    expect(unnamed.height).toBeGreaterThan(named.height);
    const namedBelow = 600 - (named.y + named.height);
    const unnamedBelow = 600 - (unnamed.y + unnamed.height);
    expect(unnamedBelow).toBeLessThan(namedBelow);
  });
});

describe("composition", () => {
  it("rasterises with real transparency and no portrait at all", async () => {
    // A missing portrait must still produce a plate: an order cannot fail
    // because an illustration is absent.
    const layout = backPlate(profile(), "KC-01248", W, H);
    const png = await composePlate(layout, null, W, H);

    const meta = await sharp(Buffer.from(png)).metadata();
    const stats = await sharp(Buffer.from(png)).stats();
    expect(meta.width).toBe(W);
    expect(meta.height).toBe(H);
    expect(meta.hasAlpha).toBe(true);
    // Genuinely transparent, not white pixels that only look it on a light page.
    expect(stats.channels[3]!.min).toBe(0);
  });

  it("places the portrait under the type", async () => {
    const portrait = await sharp({
      create: {
        width: 400,
        height: 400,
        channels: 4,
        background: { r: 200, g: 0, b: 0, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const layout = backPlate(profile(), "KC-01248", W, H);
    const png = await composePlate(layout, new Uint8Array(portrait), W, H);
    const { data, info } = await sharp(Buffer.from(png))
      .raw()
      .toBuffer({ resolveWithObject: true });

    const cx = Math.round(layout.portrait.x + layout.portrait.width / 2);
    const cy = Math.round(layout.portrait.y + layout.portrait.height / 2);
    const at = (cy * info.width + cx) * info.channels;
    expect(data[at]).toBeGreaterThan(100);
    expect(data[at + 3]).toBe(255);
  });
});
