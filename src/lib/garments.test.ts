import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { PRODUCTS, getProduct, type ProductSlug } from "@/lib/products";
import {
  GARMENT_VIEWS,
  PLACEMENT,
  PLACEMENT_OVERRIDES,
  garmentImageUrl,
  garmentViewUrl,
  photoAspect,
  photoSourceWidth,
  placementFor,
  unphotographedColours,
  type GarmentSide,
} from "./garments";

const PUBLIC = join(process.cwd(), "public");
const SIDES: GarmentSide[] = ["front", "back"];

describe("photo directories", () => {
  /*
   * The second argument is a DIRECTORY, not a colour name. The catalogue calls
   * the tote's canvas Natural and the shoot calls it beige, and the variant is
   * now the one place those two words are reconciled. Passing a colour here
   * used to work and must not: it is the difference between asking for a
   * garment and asking for a photograph.
   */
  it("resolves a photograph by directory, not by colour name", () => {
    expect(garmentImageUrl("tote", "beige", "front")).toBe(
      "/garments/tote/beige/front.webp",
    );
    expect(garmentImageUrl("tote", "Natural", "front")).toBeNull();
  });
});

describe("garment photography", () => {
  it("gives every catalogue colourway a photograph that really exists", () => {
    // The failure this prevents is an empty frame on an R899 product, which
    // reads as a broken page. Every swatch resolves to a file on disk, even the
    // colourways nobody has shot yet.
    for (const product of PRODUCTS) {
      for (const variant of product.variants) {
        for (const side of ["front", "back"] as const) {
          const url = garmentImageUrl(product.slug, variant.photoDir, side);
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
      expect(
        unphotographedColours(product.slug, product.variants),
        product.slug,
      ).toEqual([]);
    }
  });

  it("returns nothing for a directory the shoot does not have", () => {
    // Null rather than a neighbour's photograph. A swatch showing the wrong
    // garment is a returned parcel; an empty one is a bug we can see.
    //
    // A COLOUR NAME IS NOT A DIRECTORY, and asking with one must not resolve.
    // That is what stops a men's White and a women's White from collapsing
    // into a single photograph the moment they share a product.
    expect(garmentImageUrl("hoodie", "not-a-directory", "back")).toBeNull();
    expect(garmentImageUrl("hoodie", "White", "back")).toBeNull();
  });

  it("returns nothing for a view the shoot has not covered", () => {
    // Three different reasons to say null, all through the one function.
    // "worn" is deliberately included: it is a real member of GARMENT_VIEWS
    // (garments.ts), not a typo or a gap. There is no on-model photography
    // yet, so today it is correct for every product to answer null; the view
    // stays in the vocabulary so a later task can shoot it and light it up
    // just by adding files, with no change here.
    expect(garmentViewUrl("hoodie", "not-a-directory", "front")).toBeNull(); // no such colourway
    expect(garmentViewUrl("tote", "beige", "profile")).toBeNull(); // shot front-on only
    expect(garmentViewUrl("hoodie", "white", "worn")).toBeNull(); // not shot yet
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
    // would pass having executed zero assertions. It did: a reviewer stubbed
    // `garmentViewUrl` to always return null and all tests here stayed green.
    // Asserting the count catches that, and also catches a photograph
    // silently disappearing from disk while PHOTO_SHAPE still lists it. 33 is
    // the number of .webp files actually under public/garments, verified with
    // `find public/garments -type f -name '*.webp' | wc -l`. Two of the 35 are the
    // tote's, which is one photograph written to both front and back because a
    // tote's faces are identical.
    let checked = 0;
    for (const product of PRODUCTS) {
      for (const variant of product.variants) {
        for (const view of GARMENT_VIEWS) {
          const url = garmentViewUrl(product.slug, variant.photoDir, view);
          if (!url) continue; // not every garment has a fleece detail
          checked += 1;
          const meta = await sharp(join(PUBLIC, url)).metadata();
          expect(
            photoAspect(product.slug, variant.photoDir, view),
            `${product.slug}/${variant.color}/${view} is ${meta.width}x${meta.height}`,
          ).toBeCloseTo(meta.width! / meta.height!, 2);
        }
      }
    }
    expect(checked, "photographs actually checked, of 35 on disk").toBe(35);
  });

  it("reports the front and back shapes of tee/olive as the different numbers they are", () => {
    // The regression guard for the bug above, named explicitly so that a future
    // simplification back to one-shape-per-colourway fails loudly.
    expect(photoAspect("tee", "olive", "front")).toBeCloseTo(1.333, 2);
    expect(photoAspect("tee", "olive", "back")).toBeCloseTo(1.25, 2);
  });

  it("shows the tote the same photograph on both of its faces", () => {
    // A tote's two faces are the same blank canvas panel, so the shoot produced
    // one frame and the importer writes it to both names. Asserting the SHAPE
    // matches on both sides is what would catch a later reshoot landing a
    // differently-cropped back without PHOTO_SIZE being told.
    // The path says "beige" while the swatch says Natural: the shoot's word
    // for the colour and the catalogue's, reconciled on the variant's photoDir
    // rather than by the importer renaming files behind everyone's back.
    expect(garmentImageUrl("tote", "beige", "front")).toBe(
      "/garments/tote/beige/front.webp",
    );
    expect(garmentImageUrl("tote", "beige", "back")).toBe(
      "/garments/tote/beige/back.webp",
    );
    expect(photoAspect("tote", "beige", "front")).toBe(
      photoAspect("tote", "beige", "back"),
    );
  });

  it("reports each photograph's real pixel width, because the zoom ceiling needs it", async () => {
    // Not the aspect ratio. The upscale cap in print-zoom.ts asks "how many
    // pixels does this file actually have", and a ratio cannot answer that.
    // Sources are NOT uniform: crewneck Grey is 1211 and the tee's Heritage
    // Blue is 1400, so a single assumed number would license a 25% overzoom on
    // some colourways and underuse others.
    let checked = 0;
    for (const product of PRODUCTS) {
      for (const variant of product.variants) {
        for (const view of GARMENT_VIEWS) {
          const url = garmentViewUrl(product.slug, variant.photoDir, view);
          if (!url) continue;
          checked += 1;
          const meta = await sharp(join(PUBLIC, url)).metadata();
          expect(
            photoSourceWidth(product.slug, variant.photoDir, view),
            `${product.slug}/${variant.color}/${view}`,
          ).toBe(meta.width);
        }
      }
    }
    expect(checked, "photographs actually checked, of 35 on disk").toBe(35);
  });

  it("has no source width for a view nobody has photographed", () => {
    expect(photoSourceWidth("hoodie", "white", "worn")).toBeNull();
    expect(photoSourceWidth("tote", "beige", "profile")).toBeNull();
  });

  it("places every plate inside the garment image, in every colourway", () => {
    for (const product of PRODUCTS) {
      for (const variant of product.variants) {
        for (const side of SIDES) {
          const { top, left, width } = placementFor(
            product.slug,
            variant.photoDir,
            side,
          );
          const at = `${product.slug}/${variant.color}/${side}`;
          expect(top, at).toBeGreaterThan(0);
          expect(left, at).toBeGreaterThan(0);
          // A plate running off the edge of the photo is a plate off the garment.
          expect(left + width, at).toBeLessThanOrEqual(100);
          expect(width, at).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe("placementFor", () => {
  it("uses the product's placement where a colourway has no override", () => {
    // White is the tee the product placement was judged on, so it is the
    // default rather than an override of itself.
    for (const side of SIDES) {
      expect(placementFor("tee", "white", side)).toEqual(PLACEMENT.tee[side]);
    }
    // The hoodie's three shoots are framed alike, so nothing overrides them.
    for (const variant of getProduct("hoodie")!.variants) {
      for (const side of SIDES) {
        expect(placementFor("hoodie", variant.photoDir, side)).toEqual(
          PLACEMENT.hoodie[side],
        );
      }
    }
  });

  it("falls back to the product's placement for a colour with no photograph", () => {
    // No photograph means no framing to correct for. The flat swatch that
    // stands in is drawn at the product's shape, so the product's placement
    // is the one that fits it.
    expect(placementFor("tee", "not-a-directory", "back")).toEqual(
      PLACEMENT.tee.back,
    );
  });

  it("draws the tee's plates smaller on the landscape shots, where the tee fills less of the frame", () => {
    // The bug this exists for: one placement per product put a 46% back plate
    // on Olive and Heritage Blue, where the tee's torso is only 36% of the
    // photograph's width, and the plate reached for the shoulders.
    for (const dir of ["olive", "heritage-blue"]) {
      for (const side of SIDES) {
        expect(photoAspect("tee", dir, side), dir).toBeGreaterThan(1);
        expect(placementFor("tee", dir, side).width, dir).toBeLessThan(
          PLACEMENT.tee[side].width,
        );
      }
    }
  });

  it("looks up tee/olive's front and back separately, because they are framed differently", () => {
    // tee/olive's front is 1400x1050 and its back 1400x1120, so one override
    // for the colourway would be right on at most one of them.
    expect(placementFor("tee", "olive", "front")).toBe(
      PLACEMENT_OVERRIDES["tee/olive/front"],
    );
    expect(placementFor("tee", "olive", "back")).toBe(
      PLACEMENT_OVERRIDES["tee/olive/back"],
    );
  });

  it("keys every override to a printable side of a photograph a colourway really shows", () => {
    // The keys are strings, so the type system cannot catch a typo in one. A
    // mistyped key is an override that silently never applies.
    const keys = Object.keys(PLACEMENT_OVERRIDES);
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      const [slug, dir, side] = key.split("/") as [
        ProductSlug,
        string,
        GarmentSide,
      ];
      expect(SIDES, key).toContain(side);
      expect(existsSync(join(PUBLIC, "garments", key + ".webp")), key).toBe(
        true,
      );
      const variant = getProduct(slug)?.variants.find(
        (candidate) => candidate.photoDir === dir,
      );
      expect(variant, `no colourway shows ${key}`).toBeDefined();
      expect(placementFor(slug, variant!.photoDir, side), key).toEqual(
        PLACEMENT_OVERRIDES[key],
      );
    }
  });

  it("puts each plate on the same part of the garment in every colourway", async () => {
    // The overrides were calibrated by eye, and this pins what the eye was
    // matching, measured off the files: each plate is the same share of the
    // garment's body across, sits the same distance off its centre line, and
    // starts the same share of the way down the garment as it does on White,
    // the shoot each product's placement was judged on. It also catches a
    // reshoot that reframes a colourway without an override being told.
    //
    // Not the tote: it comes in one colourway, so there is nothing to agree.
    for (const slug of ["tee", "crewneck", "hoodie"] as const) {
      for (const side of SIDES) {
        const reference = await onGarment(slug, "white", side);
        for (const variant of getProduct(slug)!.variants) {
          const measured = await onGarment(slug, variant.photoDir, side);
          for (const key of ["share", "offset", "down"] as const) {
            expect(
              Math.abs(measured[key] - reference[key]),
              `${slug}/${variant.color}/${side} ${key}`,
            ).toBeLessThan(STRAY[key]);
          }
        }
      }
    }
  });
});

/**
 * How far a colourway may stray from White before it is a different placement.
 *
 * Wide enough for the measuring: a White garment is white on white, and the
 * hoodie's Lilac back reads 0.036 off on share with nothing wrong with it.
 * Tight enough for the bugs: the tee's Olive back was 0.31 off on share, and
 * the crewneck's Grey and Olive plates were 0.04 off on down.
 */
const STRAY = { share: 0.05, offset: 0.03, down: 0.025 };

/**
 * Where a plate sits relative to the garment itself, rather than to the
 * photograph: `share` is the plate's width over the body's, `offset` is how
 * far the plate's centre sits from the body's centre line in body widths, and
 * `down` is how far down the garment the plate starts.
 */
async function onGarment(
  slug: ProductSlug,
  photoDir: string,
  side: GarmentSide,
) {
  const url = garmentImageUrl(slug, photoDir, side)!;
  const garment = await outline(join(PUBLIC, url));
  const { top, left, width } = placementFor(slug, photoDir, side);
  const bodyWidth = garment.right - garment.left;
  return {
    share: width / bodyWidth,
    offset:
      (left + width / 2 - (garment.left + garment.right) / 2) / bodyWidth,
    down: (top - garment.top) / (garment.bottom - garment.top),
  };
}

/**
 * The garment's outline in a studio shot, as percentages of the photograph.
 *
 * The background measures 253 to 255, so anything darker than 240 is garment.
 * `top` and `bottom` are the first and last rows with a meaningful amount of
 * it. `left` and `right` are the body's edges, taken on the rows half to two
 * thirds of the way down the photograph and above the hem: below a tee's
 * sleeves, and across a sweater's arms, which hang alongside it in every shoot
 * alike. The MEDIAN of those rows, because a White garment is white on white
 * and a single row can lose its outline where the fabric is lit.
 */
async function outline(file: string) {
  const { data, info } = await sharp(file)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const row = (y: number) => {
    let left = -1;
    let right = -1;
    let count = 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      if (Math.min(data[i]!, data[i + 1]!, data[i + 2]!) < 240) {
        count += 1;
        if (left < 0) left = x;
        right = x;
      }
    }
    return { left, right, count };
  };

  let top = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    if (row(y).count > width * 0.02) {
      if (top < 0) top = y;
      bottom = y;
    }
  }

  const lefts: number[] = [];
  const rights: number[] = [];
  for (let y = Math.round(height * 0.5); y < height * 0.66; y++) {
    const edges = row(y);
    lefts.push(edges.left);
    rights.push(edges.right);
  }
  const median = (values: number[]) =>
    values.sort((a, b) => a - b)[Math.floor(values.length / 2)]!;

  return {
    top: (100 * top) / height,
    bottom: (100 * bottom) / height,
    left: (100 * median(lefts)) / width,
    right: (100 * median(rights)) / width,
  };
}
