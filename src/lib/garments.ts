import type { ProductSlug } from "@/lib/products";

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
 * Placement per garment and side.
 *
 * PERCENTAGES, NOT PIXELS, so it survives responsive resizing. These are the
 * spec's starting estimates and are meant to be calibrated by eye: the front
 * plate has to sit above the pocket seam and clear of the hood drawstrings, and
 * the back plate has to be centred between the shoulder seams and stop short of
 * the hem. `/dev/mockups` renders every product, colour and side at once so that
 * can be judged in one screen.
 */
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
const PHOTO_SIZE: Record<string, { w: number; h: number }> = {
  "hoodie/blue/back": { w: 1120, h: 1400 },
  "hoodie/blue/front": { w: 1120, h: 1400 },
  "hoodie/blue/profile": { w: 1120, h: 1400 },
  "hoodie/blue/fleece": { w: 1400, h: 1120 },
  "hoodie/lilac/back": { w: 1120, h: 1400 },
  "hoodie/lilac/front": { w: 1120, h: 1400 },
  "hoodie/lilac/profile": { w: 1120, h: 1400 },
  "hoodie/lilac/fleece": { w: 1400, h: 1120 },
  "hoodie/white/back": { w: 1120, h: 1400 },
  "hoodie/white/front": { w: 1120, h: 1400 },
  "hoodie/white/profile": { w: 1120, h: 1400 },
  "hoodie/white/fleece": { w: 1400, h: 1120 },
  "crewneck/white/back": { w: 1120, h: 1400 },
  "crewneck/white/front": { w: 1120, h: 1400 },
  "crewneck/white/profile": { w: 1120, h: 1400 },
  "crewneck/peach/back": { w: 1120, h: 1400 },
  "crewneck/peach/front": { w: 1120, h: 1400 },
  "crewneck/peach/profile": { w: 1120, h: 1400 },
  "crewneck/grey/back": { w: 1211, h: 1299 },
  "crewneck/grey/front": { w: 1211, h: 1299 },
  "crewneck/grey/profile": { w: 1212, h: 1297 },
  "crewneck/olive/back": { w: 1212, h: 1298 },
  "crewneck/olive/front": { w: 1212, h: 1298 },
  "crewneck/olive/profile": { w: 1212, h: 1297 },
  "tee/white/back": { w: 1144, h: 1375 },
  "tee/white/front": { w: 1144, h: 1375 },
  "tee/white/profile": { w: 1313, h: 1198 },
  "tee/heritage-blue/back": { w: 1400, h: 1111 },
  "tee/heritage-blue/front": { w: 1400, h: 1114 },
  "tee/heritage-blue/profile": { w: 1400, h: 1117 },
  "tee/olive/back": { w: 1400, h: 1120 },
  "tee/olive/front": { w: 1400, h: 1050 },
  "tee/olive/profile": { w: 1400, h: 933 },
  // ONE PHOTOGRAPH, TWO ENTRIES. A tote's two faces are the same blank canvas
  // panel, so the shoot produced a single square frame and the importer writes
  // it to both front.webp and back.webp (see scripts/import-garments.mjs). The
  // duplicate entry is not redundancy to collapse: the moment a printed back is
  // shot separately, only this line changes.
  //
  // SQUARE, where every garment is portrait or landscape. photoAspect is per
  // view for exactly this reason, so nothing here needs to special-case it.
  "tote/beige/front": { w: 1254, h: 1254 },
  "tote/beige/back": { w: 1254, h: 1254 },
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
  color: string,
  view: GarmentView = "front",
): number {
  const photo = garmentPhoto(slug, color);
  if (!photo) return DEFAULT_SHAPE;
  const size = PHOTO_SIZE[`${slug}/${photo.dir}/${view}`];
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
  color: string,
  view: GarmentView,
): number | null {
  const photo = garmentPhoto(slug, color);
  if (!photo) return null;
  return PHOTO_SIZE[`${slug}/${photo.dir}/${view}`]?.w ?? null;
}

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
 * Catalogue colourway to photographed colourway.
 *
 * EVERY COLOURWAY IS ITS OWN PHOTOGRAPH NOW. This map used to carry a whole
 * stand-in layer, where six of eleven colourways showed the nearest shot we had
 * of a different colour, because the catalogue still listed Stone, Charcoal,
 * Olive and Ecru while the shoot had produced Blue, Lilac, White, Peach, Grey,
 * Olive and Heritage Blue. The catalogue was the thing that was wrong; once it
 * named the colours we actually photographed, the stand-ins had nothing left to
 * stand in for.
 *
 * Keep it that way. If a colourway is added to products.ts without a shot
 * behind it, add the shot rather than pointing it at a neighbour: a swatch that
 * shows the wrong garment is a returned parcel.
 */
interface PhotoChoice {
  /** Directory under public/garments/<product>/. */
  dir: string;
}

const PHOTOS: Record<ProductSlug, Record<string, PhotoChoice>> = {
  hoodie: {
    Blue: { dir: "blue" },
    Lilac: { dir: "lilac" },
    White: { dir: "white" },
  },
  crewneck: {
    White: { dir: "white" },
    Peach: { dir: "peach" },
    Grey: { dir: "grey" },
    Olive: { dir: "olive" },
  },
  tee: {
    White: { dir: "white" },
    Olive: { dir: "olive" },
    "Heritage Blue": { dir: "heritage-blue" },
  },
  /*
   * THE CATALOGUE CALLS IT NATURAL AND THE SHOOT CALLS IT BEIGE. Same undyed
   * canvas, two names, and this map is the one place designed to reconcile
   * them, which is why the directory keeps the shoot's word rather than the
   * script quietly renaming the file on import. Someone grepping for "beige"
   * after looking at Stock Images finds it.
   *
   * This is NOT the stand-in layer the note above warns about: that was
   * colourways pointed at a photograph of a DIFFERENT colour. This is the
   * bag's own photograph under the name the photographer gave it. The swatch
   * a customer taps is the garment they will be sent.
   */
  tote: {
    Natural: { dir: "beige" },
  },
};

/** The photo directory a colourway shows, or null where there is none. */
export function garmentPhoto(
  slug: ProductSlug,
  color: string,
): PhotoChoice | null {
  return PHOTOS[slug][color] ?? null;
}

/**
 * The public path to a garment photograph, or null where there is none.
 *
 * Null is still a real answer: every colourway in the catalogue is
 * photographed today, but one added ahead of its shoot would land here, and
 * callers must render something sensible rather than an empty image element.
 */
export function garmentImageUrl(
  slug: ProductSlug,
  color: string,
  side: GarmentSide,
): string | null {
  const photo = garmentPhoto(slug, color);
  if (!photo) return null;
  return `/garments/${slug}/${photo.dir}/${side}.webp`;
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
  color: string,
  view: GarmentView,
): string | null {
  const photo = garmentPhoto(slug, color);
  if (!photo) return null;
  if (!(`${slug}/${photo.dir}/${view}` in PHOTO_SIZE)) return null;
  return `/garments/${slug}/${photo.dir}/${view}.webp`;
}

/**
 * Colourways in the catalogue with no photograph of their own: the shot list.
 *
 * Empty for all four garments today, the tote included since its shoot landed.
 * It is kept because the failure it catches is silent: a
 * colour added to products.ts before its shoot renders an empty frame, and the
 * page looks broken rather than incomplete.
 */
export function unphotographedColours(
  slug: ProductSlug,
  colors: string[],
): string[] {
  return colors.filter((color) => !garmentPhoto(slug, color));
}
