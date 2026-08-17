import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { PRODUCTS, type ProductSlug } from "@/lib/products";
import {
  GARMENT_VIEWS,
  PLACEMENT,
  garmentImageUrl,
  garmentPhoto,
  garmentViewUrl,
  photoAspect,
  unphotographedColours,
} from "./garments";

const PUBLIC = join(process.cwd(), "public");

describe("garment photography", () => {
  it("gives every catalogue colourway a photograph that really exists", () => {
    // The failure this prevents is an empty frame on an R899 product, which
    // reads as a broken page. Every swatch resolves to a file on disk, even the
    // colourways nobody has shot yet.
    for (const product of PRODUCTS) {
      if (product.slug === "tote") continue; // deferred, and has no photography
      for (const variant of product.variants) {
        for (const side of ["front", "back"] as const) {
          const url = garmentImageUrl(product.slug, variant.color, side);
          expect(url, `${product.slug}/${variant.color}/${side}`).toBeTruthy();
          expect(
            existsSync(join(PUBLIC, url!)),
            `missing file for ${url}`,
          ).toBe(true);
        }
      }
    }
  });

  it("has a real photograph for every worn colourway, with no stand-ins left", () => {
    // There WAS a stand-in layer here, where six of eleven colourways showed
    // the nearest shot of a different colour. It existed only because the
    // catalogue still listed Stone, Charcoal, Olive and Ecru while the shoot
    // had produced the colours we actually sell. Nothing stands in now.
    for (const product of PRODUCTS) {
      if (product.slug === "tote") continue;
      const colors = product.variants.map((variant) => variant.color);
      expect(unphotographedColours(product.slug, colors), product.slug).toEqual(
        [],
      );
    }
  });

  it("returns nothing for a colour the catalogue does not have", () => {
    // Null rather than a neighbour's photograph. A swatch showing the wrong
    // garment is a returned parcel; an empty one is a bug we can see.
    expect(garmentPhoto("hoodie", "Not A Colour")).toBeNull();
    expect(garmentImageUrl("hoodie", "Not A Colour", "back")).toBeNull();
  });

  it("returns nothing for a view the shoot has not covered", () => {
    // Three different reasons to say null, all through the one function.
    // "worn" is deliberately included: it is a real member of GARMENT_VIEWS
    // (garments.ts), not a typo or a gap. There is no on-model photography
    // yet, so today it is correct for every product to answer null; the view
    // stays in the vocabulary so a later task can shoot it and light it up
    // just by adding files, with no change here.
    expect(garmentViewUrl("hoodie", "Not A Colour", "front")).toBeNull(); // no such colourway
    expect(garmentViewUrl("tote", "Natural", "front")).toBeNull(); // no photography at all
    expect(garmentViewUrl("hoodie", "White", "worn")).toBeNull(); // not shot yet
  });

  it("knows every photograph's real shape, per view, measured from the file", async () => {
    // THE BUG THIS PREVENTS. Plate placement is a percentage of the
    // photograph, so the box the photo is drawn in has to BE the photograph's
    // shape; if it is not, the picture is letterboxed while the plate keeps
    // measuring itself against the box, and the plate lands beside the garment
    // instead of on it.
    //
    // PER VIEW, not just per colourway. The shoot varies by both: tee/olive's
    // front is 1.333 and its back is 1.250, and the earlier version of this
    // test only looked at the front, so the back plate on that colourway was
    // being placed against the wrong shape.
    //
    // WHY `checked` IS ASSERTED. Every expect() below lives after
    // `if (!url) continue`, because not every garment has a fleece or profile
    // shot. That guard is also a trapdoor: a `garmentViewUrl` that stopped
    // resolving anything would make every iteration `continue`, and this test
    // would pass having executed zero assertions. It did — a reviewer stubbed
    // `garmentViewUrl` to always return null and all tests here stayed green.
    // Asserting the count catches that, and also catches a photograph
    // silently disappearing from disk while PHOTO_SHAPE still lists it. 33 is
    // the number of .webp files actually under public/garments, verified with
    // `find public/garments -type f -name '*.webp' | wc -l`.
    let checked = 0;
    for (const product of PRODUCTS) {
      if (product.slug === "tote") continue;
      for (const variant of product.variants) {
        for (const view of GARMENT_VIEWS) {
          const url = garmentViewUrl(product.slug, variant.color, view);
          if (!url) continue; // not every garment has a fleece detail
          checked += 1;
          const meta = await sharp(join(PUBLIC, url)).metadata();
          expect(
            photoAspect(product.slug, variant.color, view),
            `${product.slug}/${variant.color}/${view} is ${meta.width}x${meta.height}`,
          ).toBeCloseTo(meta.width! / meta.height!, 2);
        }
      }
    }
    expect(checked, "photographs actually checked, of 33 on disk").toBe(33);
  });

  it("reports the front and back shapes of tee/olive as the different numbers they are", () => {
    // The regression guard for the bug above, named explicitly so that a future
    // simplification back to one-shape-per-colourway fails loudly.
    expect(photoAspect("tee", "Olive", "front")).toBeCloseTo(1.333, 2);
    expect(photoAspect("tee", "Olive", "back")).toBeCloseTo(1.25, 2);
  });

  it("has no photograph for the tote, and says so plainly", () => {
    // Deferred by docs/spec-print-layout.md. Null is the honest answer and the
    // caller shows the garment colour instead of an empty image element.
    expect(garmentImageUrl("tote", "Natural", "back")).toBeNull();
  });

  it("places every plate inside the garment image", () => {
    for (const slug of Object.keys(PLACEMENT) as ProductSlug[]) {
      for (const side of ["front", "back"] as const) {
        const { top, left, width } = PLACEMENT[slug][side];
        expect(top).toBeGreaterThan(0);
        // A plate running off the edge of the photo is a plate off the garment.
        expect(left + width).toBeLessThanOrEqual(100);
        expect(width).toBeGreaterThan(0);
      }
    }
  });
});
