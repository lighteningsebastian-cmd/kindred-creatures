import type { ProductSlug, Variant } from "@/lib/products";

/**
 * Showing a plate on the real garment.
 *
 * No image processing at request time: the photograph is a background and the
 * plate is a transparent PNG positioned over it with CSS, so the garment colour
 * shows through the plate's transparency exactly as ink will on fabric. Changing
 * colour swaps the photograph and never touches the plate.
 * See docs/spec-garment-mockups.md.
 */

/**
 * The two sides a PLATE can be printed on.
 *
 * Deliberately narrower than `GarmentView`. This is the print vocabulary, and
 * every value here has an entry in `PLACEMENT`; widening it to cover a texture
 * crop would let a caller ask where a plate sits on a close-up of fleece.
 */
export type GarmentSide = "front" | "back";

/**
 * Every kind of photograph the shoot produced, plus the on-model shot we do not
 * have yet.
 *
 * A superset of `GarmentSide`: the first two carry print, the rest do not. The
 * catalogue chooses among these (see lib/garment-shots.ts); the customizer only
 * ever asks for a side.
 */
export const GARMENT_VIEWS = [
  "back",
  "front",
  "profile",
  "worn",
  "fleece",
] as const;

export type GarmentView = (typeof GARMENT_VIEWS)[number];

/** Where a plate sits on a garment photo, as percentages of the image box. */
export interface PlatePlacement {
  /** % from the top of the image. */
  top: number;
  /** % from the left of the image. */
  left: number;
  /** % of the image width. */
  width: number;
}

/**
 * The size of each photograph in real pixels, keyed by product, colourway
 * AND VIEW.
 *
 * THE MEASUREMENTS, NOT THE RATIO. This held `w / h` and answered only "what
 * shape is it". Two callers now need two different things from one truth:
 * `photoAspect` wants the shape, and `photoSourceWidth` wants the pixel count,
 * because the zoom ceiling in lib/print-zoom.ts decides how far a photograph
 * may be enlarged past its own resolution. Dividing here would force a second
 * table holding the same measurements twice, and two tables of the same
 * numbers drift.
 *
 * PLACEMENT IS A PERCENTAGE OF THE PHOTOGRAPH, so the box the photo is drawn in
 * has to BE the photograph's shape. Let the box be any other shape and the
 * picture is letterboxed while the plate keeps measuring itself against the
 * box, which puts the plate on the empty space beside the garment.
 *
 * THIS IS PER VIEW AS WELL AS PER COLOURWAY, because the shoot was not
 * consistent in either direction. Per colourway was already necessary: the
 * tee's Heritage Blue and Olive shots are LANDSCAPE while its White is
 * portrait. Per view turned out to be necessary too, and more quietly:
 * tee/olive's front is 1.333 and its back is 1.250, so a single number per
 * colourway placed that garment's back plate against a box six percent wrong.
 * Its profile is 1.501, wrong by an eighth.
 *
 * Measured from the files with sharp, never assumed. Worth reshooting to one
 * ratio per product eventually; until then the code has to tell the truth about
 * what is on disk.
 */
/*
 * KEYED BY PRODUCT, FIT, COLOURWAY AND VIEW. The fit is in the path because
 * the men's and the women's crewneck both come in White and are different
 * photographs at different shapes, 0.67 against 0.80. One key per garment is
 * the whole reason the fit is a directory.
 *
 * ALL 48 PHOTOGRAPHS ON DISK ARE LISTED, including the women's tee, the men's
 * crewneck in White and the women's crewneck in Pea Green, which no catalogue
 * entry points at yet. This table is a manifest of the shoot rather than of the
 * range: a manifest that listed half of what is on disk is the kind of drift
 * the measuring test exists to catch.
 */
const PHOTO_SIZE: Record<string, { w: number; h: number }> = {
  "crewneck/mens/grey/back": { w: 1211, h: 1299 },
  "crewneck/mens/grey/front": { w: 1211, h: 1299 },
  "crewneck/mens/grey/profile": { w: 1212, h: 1297 },
  "crewneck/mens/olive/back": { w: 1212, h: 1298 },
  "crewneck/mens/olive/front": { w: 1212, h: 1298 },
  "crewneck/mens/olive/profile": { w: 1212, h: 1297 },
  "crewneck/mens/white/back": { w: 943, h: 1400 },
  "crewneck/mens/white/front": { w: 943, h: 1400 },
  "crewneck/mens/white/profile": { w: 943, h: 1400 },
  // Front only. The back is where the plate goes, so this cannot be sold until
  // the rest of it is shot, and no variant points at it.
  "crewneck/womens/pea-green/front": { w: 1120, h: 1400 },
  "crewneck/womens/peach/back": { w: 1120, h: 1400 },
  "crewneck/womens/peach/front": { w: 1120, h: 1400 },
  "crewneck/womens/peach/profile": { w: 1120, h: 1400 },
  "crewneck/womens/white/back": { w: 1120, h: 1400 },
  "crewneck/womens/white/front": { w: 1120, h: 1400 },
  "crewneck/womens/white/profile": { w: 1120, h: 1400 },
  "hoodie/unisex/blue/back": { w: 1120, h: 1400 },
  "hoodie/unisex/blue/fleece": { w: 1400, h: 1120 },
  "hoodie/unisex/blue/front": { w: 1120, h: 1400 },
  "hoodie/unisex/blue/profile": { w: 1120, h: 1400 },
  "hoodie/unisex/lilac/back": { w: 1120, h: 1400 },
  "hoodie/unisex/lilac/fleece": { w: 1400, h: 1120 },
  "hoodie/unisex/lilac/front": { w: 1120, h: 1400 },
  "hoodie/unisex/lilac/profile": { w: 1120, h: 1400 },
  "hoodie/unisex/white/back": { w: 1120, h: 1400 },
  "hoodie/unisex/white/fleece": { w: 1400, h: 1120 },
  "hoodie/unisex/white/front": { w: 1120, h: 1400 },
  "hoodie/unisex/white/profile": { w: 1120, h: 1400 },
  "tee/mens/heritage-blue/back": { w: 1400, h: 1111 },
  "tee/mens/heritage-blue/front": { w: 1400, h: 1114 },
  "tee/mens/heritage-blue/profile": { w: 1400, h: 1117 },
  "tee/mens/olive/back": { w: 1400, h: 1120 },
  "tee/mens/olive/front": { w: 1400, h: 1050 },
  "tee/mens/olive/profile": { w: 1400, h: 933 },
  "tee/mens/white/back": { w: 1144, h: 1375 },
  "tee/mens/white/front": { w: 1144, h: 1375 },
  "tee/mens/white/profile": { w: 1313, h: 1198 },
  // The women's tee is the most consistent set in the shoot: one shape across
  // all three colourways and all three views, and much narrower than the men's
  // 0.83. No variant points at these until the catalogue splits.
  "tee/womens/blue/back": { w: 932, h: 1400 },
  "tee/womens/blue/front": { w: 932, h: 1400 },
  "tee/womens/blue/profile": { w: 932, h: 1400 },
  "tee/womens/peach/back": { w: 932, h: 1400 },
  "tee/womens/peach/front": { w: 932, h: 1400 },
  "tee/womens/peach/profile": { w: 932, h: 1400 },
  "tee/womens/white/back": { w: 932, h: 1400 },
  "tee/womens/white/front": { w: 932, h: 1400 },
  "tee/womens/white/profile": { w: 932, h: 1400 },
  // ONE PHOTOGRAPH, TWO ENTRIES. A tote's two faces are the same blank canvas
  // panel, so the shoot produced a single square frame and the importer writes
  // it to both front.webp and back.webp (see scripts/import-garments.mjs). The
  // duplicate entry is not redundancy to collapse: the moment a printed back is
  // shot separately, only this line changes.
  //
  // SQUARE, where every garment is portrait or landscape. photoAspect is per
  // view for exactly this reason, so nothing here needs to special-case it.
  "tote/unisex/beige/back": { w: 1254, h: 1254 },
  "tote/unisex/beige/front": { w: 1254, h: 1254 },
};

/**
 * Fallback shape for a colourway or view with no photograph behind it.
 *
 * Nothing in the catalogue reaches this today; the tote, which used to be the
 * example here, is photographed. It stays because `unphotographedColours` only
 * catches a missing COLOURWAY, and a colourway whose photograph exists in one
 * view but not another would otherwise letterbox silently.
 */
const DEFAULT_SHAPE = 4 / 5;

/**
 * The shape of the photograph shown for a product, colourway and view.
 *
 * The view defaults to "front" so that existing callers asking about a garment
 * in general get the shape they always got.
 */
export function photoAspect(
  slug: ProductSlug,
  photoDir: string,
  view: GarmentView = "front",
): number {
  const size = PHOTO_SIZE[`${slug}/${photoDir}/${view}`];
  return size ? size.w / size.h : DEFAULT_SHAPE;
}

/**
 * The photograph's real width in pixels.
 *
 * The zoom ceiling in lib/print-zoom.ts is the only caller, and it needs
 * PIXELS, not a ratio: "may this be drawn at 3400px wide" is a question about
 * how many pixels the file actually has, and a shape cannot answer it. That is
 * the whole reason PHOTO_SIZE stores the measurements rather than dividing them
 * away.
 *
 * Null where there is no such photograph: any colourway or view the shoot has
 * not covered.
 */
export function photoSourceWidth(
  slug: ProductSlug,
  photoDir: string,
  view: GarmentView,
): number | null {
  return PHOTO_SIZE[`${slug}/${photoDir}/${view}`]?.w ?? null;
}

/**
 * Placement per garment and side: the DEFAULT for every colourway of it.
 *
 * PERCENTAGES, NOT PIXELS, so it survives responsive resizing. These are the
 * spec's starting estimates and are meant to be calibrated by eye: the front
 * plate has to sit above the pocket seam and clear of the hood drawstrings, and
 * the back plate has to be centred between the shoulder seams and stop short of
 * the hem. `/dev/mockups` renders every product, colour and side at once so that
 * can be judged in one screen.
 *
 * READ IT THROUGH `placementFor`, never directly. A percentage of the
 * photograph is only right for photographs framed like the one it was judged
 * on, and the shoot did not frame every colourway alike; PLACEMENT_OVERRIDES
 * below holds the ones it did not.
 */
export const PLACEMENT: Record<
  ProductSlug,
  Record<GarmentSide, PlatePlacement>
> = {
  hoodie: {
    // Left chest from the WEARER's point of view, so right of centre on screen.
    front: { top: 30, left: 56, width: 13 },
    // BELOW THE HOOD. The hood fills roughly the top fifth of the photograph and
    // nothing may enter it: KINDRED CREATURES was printing across it.
    back: { top: 34, left: 27, width: 46 },
  },
  crewneck: {
    front: { top: 28, left: 56, width: 13 },
    // No hood, but the collar and the shoulder seams still need clearing.
    back: { top: 29, left: 27, width: 46 },
  },
  tee: {
    front: { top: 26, left: 56, width: 13 },
    back: { top: 27, left: 27, width: 46 },
  },
  /*
   * CALIBRATED AGAINST THE PHOTOGRAPH, NOT AGAINST A RATIFIED PRINT LAYOUT.
   * The other three placements implement docs/spec-print-layout.md; that spec
   * says in its own first lines that the tote is deferred, so there is no owner
   * decision to implement here. These numbers were measured off
   * public/garments/tote/beige/: the bag's front panel spans 17% to 79%
   * across and 37% to 90% down, and the handle tabs are stitched onto it as far
   * as 47%, so both plates start below that and stop above the bottom seam.
   *
   * THE BACK PLATE IS DRAWN SMALLER THAN ITS OWN PRINT AREA CLAIMS, and that
   * is the honest reading rather than a mistake. products.ts declares the
   * tote's back print 260 by 300mm, copied from the garment plates while the
   * tote was deferred. Drawn to that scale on a bag this shape it would cover
   * the handle stitching and run into the bottom seam: 300mm of print down a
   * panel around 340mm tall is not a layout anyone would print. So the width
   * here is what sits correctly on the bag, and the gap between the two is the
   * evidence that the tote's print area still needs an owner decision. Once it
   * has one, set the width from it and delete this paragraph.
   */
  tote: {
    // No chest to sit on: a small print on a tote goes centred, high on the
    // panel and clear of the handle tabs.
    front: { top: 50, left: 40, width: 16 },
    back: { top: 48, left: 30, width: 33 },
  },
};

/**
 * Placement for the photographs framed unlike the rest of their product,
 * keyed like PHOTO_SIZE: product, photo directory and side.
 *
 * WHY THIS EXISTS. PLACEMENT is a percentage of the photograph, so it is only
 * right where the garment fills the same share of the frame. The tee's White
 * shots are portrait and the tee fills them, with its torso 48% of the width;
 * its Olive and Heritage Blue shots are landscape, and the same tee is 36%.
 * One number per product put a 46% back plate across nearly the whole back on
 * those two and reached for the shoulders, while it was right on White.
 *
 * PER SIDE AS WELL AS PER COLOURWAY, because a colourway's front and back were
 * not framed alike either: tee/olive's front is 1400x1050 and its back
 * 1400x1120.
 *
 * CALIBRATED TO MATCH WHITE, which is the shoot PLACEMENT.tee was judged on.
 * Each plate is the same share of the torso's width, the same distance off its
 * centre line and the same share of the way down the garment as it is on
 * White, measured off the files and then checked by eye on /dev/mockups. The
 * test that pins this measures the files again, so a reshoot that reframes a
 * colourway fails there rather than quietly moving a plate.
 *
 * THE CREWNECK'S GREY AND OLIVE MOVE UP, AND ONLY UP. Those two were shot
 * nearer square (1211x1299) than its White and Peach (1120x1400). Across, the
 * sweater fills the same share of the frame in all four, so left and width
 * stand; down, it starts higher and runs further, so the product's top put
 * both plates about four points lower on the garment and the back plate's
 * bottom line crowded the ribbed hem. Each top here starts the plate the same
 * share of the way down the sweater as on White and Peach.
 *
 * Nothing else is here because nothing else needs to be: the hoodie's three
 * shoots are framed alike. When a product is reshot to one framing, delete its
 * entries.
 */
export const PLACEMENT_OVERRIDES: Partial<Record<string, PlatePlacement>> = {
  "tee/mens/olive/front": { top: 26, left: 54.4, width: 9.3 },
  "tee/mens/olive/back": { top: 27, left: 32.5, width: 35 },
  "tee/mens/heritage-blue/front": { top: 25.3, left: 54.7, width: 9.7 },
  "tee/mens/heritage-blue/back": { top: 27, left: 32.5, width: 35 },
  "crewneck/mens/grey/front": { top: 25, left: 56, width: 13 },
  "crewneck/mens/grey/back": { top: 25, left: 27, width: 46 },
  "crewneck/mens/olive/front": { top: 25, left: 56, width: 13 },
  "crewneck/mens/olive/back": { top: 25, left: 27, width: 46 },
};

/**
 * Where the plate sits on the photograph a colourway shows, for one side.
 *
 * The override for that exact photograph where there is one, and the
 * product's placement otherwise. A colour with no photograph gets the product's
 * placement too: it is drawn on a flat swatch, and there is no framing to
 * correct for.
 */
export function placementFor(
  slug: ProductSlug,
  photoDir: string,
  side: GarmentSide,
): PlatePlacement {
  return (
    PLACEMENT_OVERRIDES[`${slug}/${photoDir}/${side}`] ?? PLACEMENT[slug][side]
  );
}

/**
 * EVERY COLOURWAY IS ITS OWN PHOTOGRAPH, and the variant is what says which.
 *
 * A map from catalogue colour to photographed colour used to live here. It had
 * to go, not because it was wrong but because it could not be made right: it
 * was keyed on colour NAME, and a men's White crewneck and a women's White
 * crewneck are two garments that share one. `Variant.photoDir` in products.ts
 * holds that answer now, next to the garment it belongs to.
 *
 * What the map warned about still stands. If a colourway reaches the catalogue
 * without a shot behind it, add the shot rather than pointing it at a
 * neighbour: a swatch that shows the wrong garment is a returned parcel.
 * `unphotographedColours` and the filesystem test in products.test.ts are what
 * catch it.
 */

/**
 * The public path to a garment photograph, or null where there is none.
 *
 * Null is still a real answer: every colourway in the catalogue is
 * photographed today, but one added ahead of its shoot would land here, and
 * callers must render something sensible rather than an empty image element.
 */
export function garmentImageUrl(
  slug: ProductSlug,
  photoDir: string,
  side: GarmentSide,
): string | null {
  if (!(`${slug}/${photoDir}/${side}` in PHOTO_SIZE)) return null;
  return `/garments/${slug}/${photoDir}/${side}.webp`;
}

/**
 * The public path to any view of a garment, or null where there is none.
 *
 * The generalisation of `garmentImageUrl` past the two printable sides. Null is
 * a real answer: no garment has a `worn` shot yet, and only the hoodie has
 * `fleece`. Callers must render something sensible rather than an empty image
 * element.
 */
export function garmentViewUrl(
  slug: ProductSlug,
  photoDir: string,
  view: GarmentView,
): string | null {
  if (!(`${slug}/${photoDir}/${view}` in PHOTO_SIZE)) return null;
  return `/garments/${slug}/${photoDir}/${view}.webp`;
}

/**
 * Variants in the catalogue with no photograph of their own: the shot list.
 *
 * Empty for all four garments today, the tote included since its shoot landed.
 * It is kept because the failure it catches is silent: a colourway added to
 * products.ts before its shoot renders an empty frame, and the page looks
 * broken rather than incomplete.
 *
 * It takes VARIANTS rather than colour names because a colour name no longer
 * identifies a photograph. Both printable sides must be there: a garment with
 * a front and no back cannot carry the plate that pays for it.
 */
export function unphotographedColours(
  slug: ProductSlug,
  variants: Variant[],
): string[] {
  return variants
    .filter(
      (variant) =>
        !garmentImageUrl(slug, variant.photoDir, "front") ||
        !garmentImageUrl(slug, variant.photoDir, "back"),
    )
    .map((variant) => variant.color);
}
