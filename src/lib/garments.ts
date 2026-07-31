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

export type GarmentSide = "front" | "back";

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
 * The shape of each product's photography, width over height.
 *
 * PLACEMENT IS A PERCENTAGE OF THE PHOTOGRAPH, so the box the photo is drawn in
 * has to BE the photograph's shape. Let the box be any other shape and
 * `object-contain` letterboxes the picture while the plate keeps measuring
 * itself against the box, which puts the plate on the empty space beside the
 * garment. Measured from the files: hoodie 1120x1400, tee 1144x1375,
 * crewneck 1211x1299.
 */
export const PHOTO_ASPECT: Record<ProductSlug, number> = {
  hoodie: 1120 / 1400,
  tee: 1144 / 1375,
  crewneck: 1211 / 1299,
  // No photography; the plate sits on a plain colour, so any sane shape will do.
  tote: 4 / 5,
};

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
 * THE PHOTOGRAPHY DOES NOT MATCH THE CATALOGUE and that is an open owner
 * decision (docs/spec-garment-mockups.md section 5). Six of the eleven
 * colourways have no photograph of their own. Rather than show an empty box on a
 * R899 product, each falls back to the nearest shot we do have, and every one of
 * those is marked `standIn` below so the list of what still needs shooting is
 * readable from the code rather than guessed at.
 *
 * The recommendation in that spec stands: launch on the colours that have real
 * photographs, and add the rest as photography allows. Washed Black cannot
 * launch at all until the printer says how dark garments are handled.
 */
interface PhotoChoice {
  /** Directory under public/garments/<product>/. */
  dir: string;
  /** True when this is the nearest shot rather than this actual colourway. */
  standIn: boolean;
}

const PHOTOS: Record<ProductSlug, Record<string, PhotoChoice>> = {
  hoodie: {
    Stone: { dir: "white", standIn: false },
    Charcoal: { dir: "blue", standIn: true },
    Olive: { dir: "lilac", standIn: true },
  },
  crewneck: {
    Stone: { dir: "grey", standIn: false },
    Charcoal: { dir: "grey", standIn: true },
  },
  tee: {
    Stone: { dir: "white", standIn: false },
    Charcoal: { dir: "heritage-blue", standIn: true },
    Olive: { dir: "olive", standIn: false },
    Ecru: { dir: "white", standIn: true },
  },
  // No tote photography, and no plate for it either.
  tote: {},
};

/** The photo directory a colourway shows, and whether it is really that colour. */
export function garmentPhoto(
  slug: ProductSlug,
  color: string,
): PhotoChoice | null {
  const forProduct = PHOTOS[slug];
  const exact = forProduct[color];
  if (exact) return exact;

  // An unmapped colour still has to show a garment: the preview is on screen
  // from the first paint and an empty frame reads as a broken page. The first
  // mapped colour is the product's own neutral, which is the least wrong option.
  const [fallback] = Object.values(forProduct);
  return fallback ? { dir: fallback.dir, standIn: true } : null;
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

/** Every colourway whose photograph is a stand-in, for the owner's shot list. */
export function standInColours(
  slug: ProductSlug,
): { color: string; showing: string }[] {
  return Object.entries(PHOTOS[slug])
    .filter(([, photo]) => photo.standIn)
    .map(([color, photo]) => ({ color, showing: photo.dir }));
}
