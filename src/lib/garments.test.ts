import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { PRODUCTS, type ProductSlug } from "@/lib/products";
import {
  PLACEMENT,
  garmentImageUrl,
  garmentPhoto,
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

  it("knows each photograph's real shape, measured from the file", async () => {
    // THE BUG THIS PREVENTS. Plate placement is a percentage of the
    // photograph, so the box the photo is drawn in has to BE the photograph's
    // shape; if it is not, the picture is letterboxed while the plate keeps
    // measuring itself against the box, and the plate lands beside the garment
    // instead of on it.
    //
    // The shoot was not consistent, so this is per COLOURWAY. A single
    // per-product ratio was wrong for half the range: the tee's Heritage Blue
    // and Olive shots are landscape while its White is portrait.
    for (const product of PRODUCTS) {
      if (product.slug === "tote") continue;
      for (const variant of product.variants) {
        const url = garmentImageUrl(product.slug, variant.color, "front")!;
        const meta = await sharp(join(PUBLIC, url)).metadata();
        expect(
          photoAspect(product.slug, variant.color),
          `${product.slug}/${variant.color} is ${meta.width}x${meta.height}`,
        ).toBeCloseTo(meta.width! / meta.height!, 2);
      }
    }
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
