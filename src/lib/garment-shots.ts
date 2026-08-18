import {
  garmentViewUrl,
  photoAspect,
  type GarmentView,
} from "@/lib/garments";
import type { ProductSlug } from "@/lib/products";

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
  // Deferred (docs/spec-print-layout.md): no shoot, no plate. Its card keeps
  // the hatched PhotoFrame, which is the honest treatment for a garment that
  // does not exist yet.
  tote: [],
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

/** Ordered shots for a product's hero colourway. Empty for the tote. */
export function catalogueShots(slug: ProductSlug): Shot[] {
  const colour = heroColour(slug);
  if (!colour) return [];

  const shots: Shot[] = [];
  for (const view of VIEWS[slug]) {
    const url = garmentViewUrl(slug, colour, view);
    if (!url) continue;
    const printed = view === "front" || view === "back";
    shots.push({
      view,
      url,
      alt: altFor(slug, colour, view),
      printed,
      plateUrl: plateFor(slug, view),
      aspect: photoAspect(slug, colour, view),
    });
  }
  return shots;
}
