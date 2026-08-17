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
 * The shape of each photograph, width over height, keyed by product, colourway
 * AND VIEW.
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
const PHOTO_SHAPE: Record<string, number> = {
  "hoodie/blue/back": 1120 / 1400,
  "hoodie/blue/front": 1120 / 1400,
  "hoodie/blue/profile": 1120 / 1400,
  "hoodie/blue/fleece": 1400 / 1120,
  "hoodie/lilac/back": 1120 / 1400,
  "hoodie/lilac/front": 1120 / 1400,
  "hoodie/lilac/profile": 1120 / 1400,
  "hoodie/lilac/fleece": 1400 / 1120,
  "hoodie/white/back": 1120 / 1400,
  "hoodie/white/front": 1120 / 1400,
  "hoodie/white/profile": 1120 / 1400,
  "hoodie/white/fleece": 1400 / 1120,
  "crewneck/white/back": 1120 / 1400,
  "crewneck/white/front": 1120 / 1400,
  "crewneck/white/profile": 1120 / 1400,
  "crewneck/peach/back": 1120 / 1400,
  "crewneck/peach/front": 1120 / 1400,
  "crewneck/peach/profile": 1120 / 1400,
  "crewneck/grey/back": 1211 / 1299,
  "crewneck/grey/front": 1211 / 1299,
  "crewneck/grey/profile": 1212 / 1297,
  "crewneck/olive/back": 1212 / 1298,
  "crewneck/olive/front": 1212 / 1298,
  "crewneck/olive/profile": 1212 / 1297,
  "tee/white/back": 1144 / 1375,
  "tee/white/front": 1144 / 1375,
  "tee/white/profile": 1313 / 1198,
  "tee/heritage-blue/back": 1400 / 1111,
  "tee/heritage-blue/front": 1400 / 1114,
  "tee/heritage-blue/profile": 1400 / 1117,
  "tee/olive/back": 1400 / 1120,
  "tee/olive/front": 1400 / 1050,
  "tee/olive/profile": 1400 / 933,
};

/** Fallback shape for a garment with no photograph, such as the tote. */
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
  return PHOTO_SHAPE[`${slug}/${photo.dir}/${view}`] ?? DEFAULT_SHAPE;
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
  // The tote is deferred (docs/spec-print-layout.md) and has no photography, so
  // it has no plate to place. Kept here so the record stays exhaustive.
  tote: {
    front: { top: 30, left: 25, width: 50 },
    back: { top: 30, left: 25, width: 50 },
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
  // No tote photography, and no plate for it either. It is deferred.
  tote: {},
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
 * Null is a real answer (the tote), and callers must render something sensible
 * rather than an empty image element.
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
 * a real answer twice over: the tote has no photography at all, and no garment
 * has a `worn` shot yet. Callers must render something sensible rather than an
 * empty image element.
 */
export function garmentViewUrl(
  slug: ProductSlug,
  color: string,
  view: GarmentView,
): string | null {
  const photo = garmentPhoto(slug, color);
  if (!photo) return null;
  if (!(`${slug}/${photo.dir}/${view}` in PHOTO_SHAPE)) return null;
  return `/garments/${slug}/${photo.dir}/${view}.webp`;
}

/**
 * Colourways in the catalogue with no photograph of their own: the shot list.
 *
 * Empty for the three garments today, and the tote's whole range for as long as
 * it stays deferred. It is kept because the failure it catches is silent: a
 * colour added to products.ts before its shoot renders an empty frame, and the
 * page looks broken rather than incomplete.
 */
export function unphotographedColours(
  slug: ProductSlug,
  colors: string[],
): string[] {
  return colors.filter((color) => !garmentPhoto(slug, color));
}
