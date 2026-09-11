import {
  garmentViewUrl,
  photoAspect,
  photoSourceWidth,
  type GarmentView,
} from "@/lib/garments";
import { getProduct, type ProductSlug } from "@/lib/products";

/**
 * Which photographs a catalogue card shows, and in what order.
 *
 * SEPARATE FROM lib/garments.ts ON PURPOSE. That module answers "where does ink
 * go on this garment", and the customizer is its caller. This one answers
 * "which pictures does a card show, in what order, and what does each one say
 * to a screen reader". They share the placement numbers rather than each
 * keeping a copy, because a shop card that advertises a print in a different
 * position from the one we make is a returned parcel.
 *
 * See docs/superpowers/specs/2026-08-17-catalogue-photography-design.md.
 */

export interface Shot {
  view: GarmentView;
  /** Public path to the photograph. */
  url: string;
  /** Real alt text, describing the garment and the aspect. */
  alt: string;
  /** Whether a plate is overlaid. False for profile, worn and fleece. */
  printed: boolean;
  /** The demo plate to overlay, or null when the view carries no print. */
  plateUrl: string | null;
  /** The photograph's own shape, for the box it is drawn in. */
  aspect: number;
  /**
   * The PLATE's own shape, which is neither the photograph's nor a constant.
   * Null wherever `plateUrl` is null. The zoom origin cannot be found without
   * it: a plate is placed by width alone, so its height — and therefore its
   * centre — has to be recovered from both shapes. See lib/print-zoom.ts.
   */
  plateAspect: number | null;
  /** The photograph's real width in pixels, for the zoom ceiling. */
  sourceWidth: number;
  /** What the control for this shot announces: a view name, or a colour name. */
  label: string;
  /**
   * The colour to fill this shot's control with, or null for a plain dot.
   *
   * Present means "this control picks a colour", and that is the whole of what
   * GarmentShots needs to know about which page it is on. Keeping the decision
   * here rather than passing a surface flag is what stops the component from
   * growing a home-page branch.
   */
  swatchHex: string | null;
}

/**
 * The colourway that fronts each card.
 *
 * NOT the flow default, which is White on every garment (see the note over
 * PRODUCTS in lib/products.ts). Two reasons to differ here. The shapes: all
 * three of these are portrait at 0.80 to 0.83, while the tee's Heritage Blue
 * and Olive shots are landscape, so leading with one would drop a wide garment
 * into a grid of tall ones. And the parchment lift: the white studio background
 * is dropped out with `mix-blend-mode: multiply`, which tints a white garment
 * toward cream — least flattering on exactly the colourway the flow starts on.
 *
 * The hoodie's Blue is also the shot in the owner's own mockup.
 */
const HERO: Partial<Record<ProductSlug, string>> = {
  hoodie: "Blue",
  crewneck: "Peach",
  tee: "White",
  // Not a choice: the tote comes in one colourway. It is SQUARE rather than
  // portrait, which the shape argument above would otherwise argue against,
  // but a 1:1 tile among 0.80s is far less jarring than the tee's landscape
  // shots would be — and there is no alternative to lead with.
  tote: "Natural",
};

export function heroColour(slug: ProductSlug): string | null {
  return HERO[slug] ?? null;
}

/**
 * The view order per product, and the whole of the availability question.
 *
 * LISTS ONLY VIEWS THAT EXIST, never an aspiration, so a card can never render
 * a broken frame. `worn` is in GARMENT_VIEWS and in nobody's list here: there
 * is no on-model photography in the repo yet. When it arrives, drop the files
 * at public/garments/<product>/<colourway>/worn.webp and add "worn" to the
 * lines below — that is the entire change.
 *
 * A manifest rather than a filesystem probe because a server component cannot
 * stat a file on the edge, and a missing image should fail in review rather
 * than in production.
 *
 * PROFILE IS DELIBERATELY ABSENT, and the files for it exist. The
 * three-quarter shot shows a garment with no print on it, which is the one
 * thing a catalogue card is not for: every view a card offers should be
 * selling the thing that is printed. Owner decision, 18 August. Re-adding it
 * is one word per line below; nothing else has to change.
 */
const VIEWS: Record<ProductSlug, GarmentView[]> = {
  hoodie: ["back", "front", "fleece"],
  crewneck: ["back", "front"],
  tee: ["back", "front"],
  /*
   * The tote arrived shot on mid grey, which the parchment lift at the top of
   * GarmentShots.tsx cannot use: it drops the background with
   * `mix-blend-mode: multiply`, and multiply over parchment only disappears a
   * background that is already near-white. Measured, the difference is not
   * subtle — a garment's 254 background lands within 1 of the parchment it sits
   * on, while the tote's grey came out around 40% darker than it, a muddy brown
   * card. It was held out of the cards for exactly one commit, and the owner
   * supplied a white-background reshoot on 11 September.
   *
   * NO FLEECE AND NO PROFILE: there is one frame, and it is the bag's face.
   */
  tote: ["back", "front"],
};

/** Names used in alt text and on the dot controls. */
const VIEW_LABEL: Record<GarmentView, string> = {
  back: "Back",
  front: "Chest print",
  profile: "Side",
  worn: "Worn",
  fleece: "Fleece",
};

export function viewLabel(view: GarmentView): string {
  return VIEW_LABEL[view];
}

/** The product's name as it reads inside a sentence of alt text. */
const GARMENT_NOUN: Record<ProductSlug, string> = {
  hoodie: "hoodie",
  crewneck: "crewneck",
  tee: "tee",
  tote: "tote",
};

function altFor(slug: ProductSlug, colour: string, view: GarmentView): string {
  const garment = `the Kindred ${GARMENT_NOUN[slug]} in ${colour}`;
  switch (view) {
    case "back":
      return `The Kindred ${GARMENT_NOUN[slug]} in ${colour} from the back, printed with a companion profile plate`;
    case "front":
      return `The chest print on ${garment}`;
    case "profile":
      return `A three-quarter view of ${garment}`;
    case "worn":
      return `Someone wearing ${garment}`;
    case "fleece":
      return `The brushed fleece inside of ${garment}`;
  }
}

/**
 * The demo plate for a view.
 *
 * The back print area differs by product (280 by 350mm on the hoodie and
 * crewneck, 250 by 300 on the tee), and the plate is overlaid at its own
 * intrinsic shape, so the back needs one file per product. The front is
 * FRONT_PRINT on every garment, so one file serves all three.
 */
function plateFor(slug: ProductSlug, view: GarmentView): string | null {
  if (view === "back") return `/demo/plate-back-${slug}.png`;
  if (view === "front") return "/demo/plate-front.png";
  return null;
}

/**
 * Each plate's own shape, keyed by the file it comes from.
 *
 * NOT ONE NUMBER, and the exception is easy to miss. The back print area is
 * 280 by 350mm on the hoodie and crewneck but 250 by 300 on the tee, so the
 * tee's plate is 900 x 1080 where the others are 900 x 1125. Handing the tee
 * the hoodie's ratio puts its zoom origin about 4% of the photograph off
 * centre, which reads as a frame that has slipped off the print.
 *
 * Measured from the files, and asserted against them in the tests, for the
 * same reason PHOTO_SIZE is: a number nobody checked is a number that drifts.
 */
const PLATE_SHAPE: Record<string, number> = {
  "/demo/plate-front.png": 600 / 818,
  "/demo/plate-back-hoodie.png": 900 / 1125,
  "/demo/plate-back-crewneck.png": 900 / 1125,
  "/demo/plate-back-tee.png": 900 / 1080,
  // 260 by 300mm, which is a fourth shape again — neither the hoodie and
  // crewneck's 280 by 350 nor the tee's 250 by 300.
  "/demo/plate-back-tote.png": 900 / 1038,
};

/** One shot, or null when that photograph does not exist. */
function shotFor(
  slug: ProductSlug,
  colour: string,
  view: GarmentView,
): Shot | null {
  const url = garmentViewUrl(slug, colour, view);
  if (!url) return null;
  const printed = view === "front" || view === "back";
  const plateUrl = plateFor(slug, view);
  return {
    view,
    url,
    alt: altFor(slug, colour, view),
    printed,
    plateUrl,
    aspect: photoAspect(slug, colour, view),
    plateAspect: plateUrl ? (PLATE_SHAPE[plateUrl] ?? null) : null,
    sourceWidth: photoSourceWidth(slug, colour, view) ?? 0,
    label: viewLabel(view),
    swatchHex: null,
  };
}

/** Ordered shots for a product's hero colourway. Empty for the tote. */
export function catalogueShots(slug: ProductSlug): Shot[] {
  const colour = heroColour(slug);
  if (!colour) return [];

  const shots: Shot[] = [];
  for (const view of VIEWS[slug]) {
    const shot = shotFor(slug, colour, view);
    if (shot) shots.push(shot);
  }
  return shots;
}

/**
 * The back print in every colourway the product comes in. The home page's list.
 *
 * A DIFFERENT AXIS FROM catalogueShots, not a variant of it. That one varies
 * view within one colour, for a shop card whose job is "here is the print, and
 * you can look closely". This one varies colour within one view, for a home
 * tile whose job is "here are four pieces and here is the range". Two
 * functions rather than one with a surface flag, because they answer two
 * different questions and only happen to share a shot shape.
 *
 * BACK ONLY. The chest badge renders at 19 to 37px in a home tile — a control
 * promising something it cannot show. Owner decision, 18 August.
 *
 * Both lists start on the hero colourway; the note over HERO explains why that
 * ordering is worth keeping, and it still holds now that the hero is where a
 * tile STARTS rather than the only colour it ever shows.
 *
 * IT ASKS VIEWS THE SAME QUESTION catalogueShots DOES, and that is load-bearing
 * rather than symmetry for its own sake. This function reaches straight for the
 * back shot of every colourway, so for most of its life it never consulted the
 * manifest at all — which meant the day the tote's photograph landed on disk,
 * the home page started rendering it while the shop card correctly did not.
 * VIEWS is documented above as the whole of the availability question; a second
 * function answering that question its own way is how the two surfaces drift.
 */
export function colourwayShots(slug: ProductSlug): Shot[] {
  const product = getProduct(slug);
  const hero = heroColour(slug);
  if (!product || !hero) return [];
  if (!VIEWS[slug].includes("back")) return [];

  const ordered = [
    ...product.variants.filter((variant) => variant.color === hero),
    ...product.variants.filter((variant) => variant.color !== hero),
  ];

  const shots: Shot[] = [];
  for (const variant of ordered) {
    const shot = shotFor(slug, variant.color, "back");
    if (!shot) continue;
    shots.push({
      ...shot,
      label: variant.color,
      swatchHex: variant.colorHex,
    });
  }
  return shots;
}
