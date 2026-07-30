// @vitest-environment node
import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { backPlate, composePlate, frontPlate, tableRows } from "./plate";
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

describe("the data table", () => {
  it("closes up rather than printing a blank row", () => {
    const full = tableRows(profile());
    expect(full.map((r) => r.label)).toEqual([
      "BREED",
      "ORIGIN",
      "GROUP",
      "TEMPERAMENT",
      "TOGETHER SINCE",
    ]);

    const sparse = tableRows(
      profile({ temperament: [], togetherSince: null }),
    );
    expect(sparse.map((r) => r.label)).toEqual(["BREED", "ORIGIN", "GROUP"]);
    expect(sparse.every((r) => r.value.trim() !== "")).toBe(true);
  });

  it("prints One of One for an unrecorded breed", () => {
    const rows = tableRows(profile({ breedId: "one-of-one-dog-large" }));
    expect(rows.find((r) => r.label === "BREED")?.value).toBe("One of One");
    // And it says it once. The same words in two rows read as a fault.
    expect(rows.filter((r) => r.value === "One of One")).toHaveLength(1);
    // The phrase it replaces must appear nowhere, in any casing.
    expect(JSON.stringify(rows).toLowerCase()).not.toContain("mixed");
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

  it("gives other species three NAMED rows, not invented ones", () => {
    // The earlier key/value grid asked a customer with a horse to make up a
    // field name. These are the same three rows every species gets.
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
      "BREED",
      "ORIGIN",
      "TOGETHER SINCE",
    ]);
    expect(rows.find((r) => r.label === "SPECIES")?.value).toBe("Horse");
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
    expect(dates[0]!.label).toBe("TOGETHER SINCE");
    expect(rows.map((r) => r.label)).not.toContain("EST.");
    expect(rows.map((r) => r.label)).not.toContain("BORN");
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
      // Every drawn path stays within the plate's content column.
      const xs = [...svg.matchAll(/[ML](-?\d+(?:\.\d+)?) /g)].map((m) =>
        Number(m[1]),
      );
      const widest = Math.max(...xs);
      expect(widest, breedId).toBeLessThanOrEqual(W - margin + 1);
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
    const name = outlineText("Jetty", { role: "frontName", sizePx: 600 * 0.115 });
    const { portrait } = frontPlate(profile({ name: "Jetty" }), 600, 600);
    expect(portrait.y + portrait.height + name.ascent + name.descent).toBeLessThanOrEqual(600);
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
