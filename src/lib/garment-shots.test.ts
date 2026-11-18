import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { PRODUCTS, fitsFor, variantsForFit } from "@/lib/products";
import {
  catalogueShots,
  colourwayShots,
  heroColour,
} from "./garment-shots";

const PUBLIC = join(process.cwd(), "public");

describe("catalogue shots", () => {
  it("leads with the back, because the plate is the product", () => {
    for (const product of PRODUCTS) {
      expect(catalogueShots(product.slug)[0]!.view, product.slug).toBe("back");
    }
  });

  it("offers the hoodie three aspects and the tee and crewneck two", () => {
    expect(catalogueShots("hoodie").map((shot) => shot.view)).toEqual([
      "back",
      "front",
      "fleece",
    ]);
    expect(catalogueShots("tee").map((shot) => shot.view)).toEqual([
      "back",
      "front",
    ]);
    expect(catalogueShots("crewneck").map((shot) => shot.view)).toEqual([
      "back",
      "front",
    ]);
  });

  it("offers no three-quarter shot, though the photographs exist", () => {
    // Owner decision, 18 August: every view a card offers should be selling
    // the thing that is printed, and the profile shows a blank garment. The
    // files are still on disk and garments.ts still knows their shape, so this
    // is a manifest decision and not a deletion.
    for (const product of PRODUCTS) {
      const views = catalogueShots(product.slug).map((shot) => shot.view);
      expect(views, product.slug).not.toContain("profile");
    }
  });

  it("gives the tote a card now that it is shot on white", () => {
    // It had no card for one commit, on a grey-background shoot the parchment
    // lift could not use. The owner reshot it; this is the assertion that the
    // placeholder is gone. One frame, so back and front are the same picture
    // with different plates on it.
    expect(catalogueShots("tote").map((shot) => shot.view)).toEqual([
      "back",
      "front",
    ]);
  });

  it("agrees with itself about which products have card photography", () => {
    // THE BUG THIS PREVENTS, and it was live for the length of one commit.
    // colourwayShots reaches straight for the back shot of every colourway and
    // never consulted VIEWS, so the day the tote's files landed on disk the
    // home page began rendering it while the shop card correctly did not. The
    // two surfaces vary different axes and share a manifest; a product that is
    // on one and missing from the other is that manifest being answered twice.
    for (const product of PRODUCTS) {
      expect(
        colourwayShots(product.slug).length > 0,
        `${product.slug}: shop card and home tile disagree`,
      ).toBe(catalogueShots(product.slug).length > 0);
    }
  });

  it("points every shot at a file that really exists", () => {
    // The manifest lists only views that exist, never an aspiration, which is
    // what lets this be an unconditional assertion. `worn` is in the view
    // vocabulary and in no product's manifest: there is no on-model
    // photography yet. Adding the files and the manifest line is the whole of
    // the work to light it up.
    for (const product of PRODUCTS) {
      for (const shot of catalogueShots(product.slug)) {
        expect(existsSync(join(PUBLIC, shot.url)), shot.url).toBe(true);
      }
    }
  });

  it("prints only on the two sides a plate can go on", () => {
    // A plate floated over a three-quarter garment sits on air, and you cannot
    // see a chest print from the side.
    for (const product of PRODUCTS) {
      for (const shot of catalogueShots(product.slug)) {
        const printable = shot.view === "front" || shot.view === "back";
        expect(shot.printed, `${product.slug}/${shot.view}`).toBe(printable);
      }
    }
  });

  it("gives a printed shot a plate to overlay and an unprinted shot none", () => {
    for (const product of PRODUCTS) {
      for (const shot of catalogueShots(product.slug)) {
        if (shot.printed) expect(shot.plateUrl).toMatch(/^\/demo\/plate-/);
        else expect(shot.plateUrl).toBeNull();
      }
    }
  });

  it("writes alt text a person would recognise, never a filename", () => {
    const shots = catalogueShots("hoodie");
    expect(shots[0]!.alt).toBe(
      "The Kindred hoodie in Blue from the back, printed with a companion profile plate",
    );
    expect(shots[2]!.alt).toBe(
      "The brushed fleece inside of the Kindred hoodie in Blue",
    );
    for (const shot of shots) expect(shot.alt).not.toMatch(/\.webp|\//);
  });

  it("leads each card on a portrait colourway so the grid does not fight itself", () => {
    // The tee's Heritage Blue and Olive shots are LANDSCAPE. Leading with one
    // drops a wide garment into a grid of tall ones.
    expect(heroColour("hoodie", "unisex")).toBe("Blue");
    expect(heroColour("crewneck", "womens")).toBe("Peach");
    expect(heroColour("tee", "mens")).toBe("White");
    for (const product of PRODUCTS) {
      for (const fit of fitsFor(product)) {
        const hero = heroColour(product.slug, fit);
        expect(
          variantsForFit(product, fit).some(
            (variant) => variant.color === hero,
          ),
          `${product.slug}/${fit} hero ${hero} is not a real colourway`,
        ).toBe(true);
      }
      for (const shot of catalogueShots(product.slug)) {
        expect(shot.aspect, `${product.slug}/${shot.view}`).toBeGreaterThan(0);
      }
    }
  });
});

describe("a lead colourway per fit", () => {
  /*
   * The guard that stops a fit arriving in the catalogue without a shot to
   * lead with. A missing hero makes catalogueShots return nothing, which is a
   * card with no photograph on it: silent, and on the shop page.
   */
  it("gives every product and fit a lead colourway", () => {
    for (const product of PRODUCTS) {
      for (const fit of fitsFor(product)) {
        expect(
          heroColour(product.slug, fit),
          `${product.slug}/${fit}`,
        ).toBeTruthy();
      }
    }
  });

  it("shows nothing for a fit the product is not cut in", () => {
    // The hoodie has one cut for everyone. Asking it for a women's fit has to
    // come back empty rather than handing over the unisex photographs, which
    // is the whole failure this branch exists to stop.
    expect(heroColour("hoodie", "womens")).toBeNull();
    expect(colourwayShots("hoodie", "womens")).toEqual([]);
    expect(catalogueShots("hoodie", "womens")).toEqual([]);
  });

  it("cycles only the requested fit's own photographs", () => {
    for (const product of PRODUCTS) {
      for (const fit of fitsFor(product)) {
        const allowed = variantsForFit(product, fit).map(
          (variant) => variant.photoDir,
        );
        for (const shot of colourwayShots(product.slug, fit)) {
          expect(allowed, `${product.slug}/${fit}`).toContain(shot.photoDir);
        }
      }
    }
  });
});

describe("colourwayShots", () => {
  it("offers one shot per colourway, and every one is the back", () => {
    // The home page varies colour; the shop varies view. A front shot here
    // would be the 19px chest badge this change exists to remove.
    // One tile shows one fit's colourways, not a product's: the count is the
    // leading fit's, which is what the home page renders.
    for (const product of PRODUCTS) {
      const leading = product.variants[0]!.fit;
      const shots = colourwayShots(product.slug);
      expect(shots.length, product.slug).toBe(
        variantsForFit(product, leading).length,
      );
      expect(
        shots.every((shot) => shot.view === "back"),
        product.slug,
      ).toBe(true);
    }
  });

  it("counts a tile by its leading fit, not by the whole product", () => {
    expect(colourwayShots("hoodie")).toHaveLength(3);
    // Two, not five: the women's sweater is what the home tile shows, and the
    // men's three are a tile the home page does not have.
    expect(colourwayShots("crewneck")).toHaveLength(2);
    expect(colourwayShots("crewneck", "mens")).toHaveLength(3);
    expect(colourwayShots("tee")).toHaveLength(3);
    expect(colourwayShots("tee", "womens")).toHaveLength(3);
    expect(colourwayShots("tote")).toHaveLength(1); // one colourway, one shot
  });

  it("starts on the hero colourway", () => {
    expect(colourwayShots("hoodie")[0]!.label).toBe("Blue");
    expect(colourwayShots("crewneck")[0]!.label).toBe("Peach");
    expect(colourwayShots("tee")[0]!.label).toBe("White");
  });

  it("takes every swatch colour from products.ts, so it cannot drift from stock", () => {
    for (const product of PRODUCTS) {
      for (const shot of colourwayShots(product.slug)) {
        const variant = product.variants.find((v) => v.color === shot.label);
        expect(
          variant,
          `${product.slug} has no variant named ${shot.label}`,
        ).toBeDefined();
        expect(shot.swatchHex).toBe(variant!.colorHex);
      }
    }
  });

  it("points every colourway at a photograph that really exists", () => {
    for (const product of PRODUCTS) {
      for (const shot of colourwayShots(product.slug)) {
        expect(existsSync(join(PUBLIC, shot.url)), shot.url).toBe(true);
      }
    }
  });
});

describe("what every shot carries", () => {
  it("gives a printed shot the shape of its own plate", () => {
    // The tee's back plate is 900x1080 and the others are 900x1125. One number
    // for all of them mis-frames the tee's zoom.
    const tee = catalogueShots("tee").find((shot) => shot.view === "back")!;
    const hoodie = catalogueShots("hoodie").find(
      (shot) => shot.view === "back",
    )!;
    expect(tee.plateAspect).toBeCloseTo(900 / 1080, 4);
    expect(hoodie.plateAspect).toBeCloseTo(900 / 1125, 4);
  });

  it("leaves plateAspect null exactly where there is no plate", () => {
    for (const product of PRODUCTS) {
      for (const shot of catalogueShots(product.slug)) {
        expect(shot.plateAspect === null, `${product.slug}/${shot.view}`).toBe(
          !shot.printed,
        );
      }
    }
  });

  it("carries the source width the zoom ceiling needs", () => {
    for (const product of PRODUCTS) {
      for (const shot of catalogueShots(product.slug)) {
        expect(shot.sourceWidth, `${product.slug}/${shot.view}`).toBeGreaterThan(
          0,
        );
      }
    }
  });

  it("measures every plate shape from the file it names", async () => {
    // The comment over PLATE_SHAPE says these are measured, not assumed. This
    // is what makes that true. A re-exported plate at a new size, or a fourth
    // product whose plate nobody measured, fails here rather than silently
    // framing the zoom off the print.
    let checked = 0;
    for (const product of PRODUCTS) {
      for (const shot of catalogueShots(product.slug)) {
        if (!shot.plateUrl) continue;
        checked += 1;
        const meta = await sharp(join(PUBLIC, shot.plateUrl)).metadata();
        expect(
          shot.plateAspect,
          `${shot.plateUrl} is ${meta.width}x${meta.height}`,
        ).toBeCloseTo(meta.width! / meta.height!, 4);
      }
    }
    expect(checked, "plates actually checked").toBeGreaterThan(0);
  });

  it("labels a view shot with its view and leaves it unswatched", () => {
    const shots = catalogueShots("hoodie");
    expect(shots[0]!.label).toBe("Back");
    expect(shots.every((shot) => shot.swatchHex === null)).toBe(true);
  });
});
