import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { PRODUCTS, type ProductSlug } from "@/lib/products";
import {
  PLACEMENT,
  garmentImageUrl,
  garmentPhoto,
  standInColours,
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

  it("says so when a colourway is wearing someone else's photograph", () => {
    // The owner's shot list, readable from the code rather than guessed at.
    const hoodie = standInColours("hoodie");
    expect(hoodie.length).toBeGreaterThan(0);
    for (const entry of hoodie) {
      expect(garmentPhoto("hoodie", entry.color)?.standIn).toBe(true);
    }

    // And a colourway that really was photographed is not marked as one.
    expect(garmentPhoto("hoodie", "Stone")?.standIn).toBe(false);
  });

  it("falls back rather than returning nothing for an unknown colour", () => {
    const url = garmentImageUrl("hoodie", "Not A Colour", "back");
    expect(url).toBeTruthy();
    expect(existsSync(join(PUBLIC, url!))).toBe(true);
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
