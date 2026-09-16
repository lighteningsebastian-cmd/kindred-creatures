import type { PlatePlacement } from "@/lib/garments";

/**
 * Framing the print, not the garment.
 *
 * THE OBVIOUS LIGHTBOX DOES NOT WORK, and this module exists because of it. A
 * modal showing the whole hoodie at 92% of screen height puts the chest badge
 * at about 105px, against the 67px it already is on a shop card. That is a
 * focus trap, an escape handler and a scroll lock bought for 1.6x, still
 * unreadable. The badge is 13% of the garment's width; no amount of showing
 * more garment fixes that. So the zoom frames the PLATE, and everything here
 * is the arithmetic for doing so.
 *
 * Pure on purpose: no React, no DOM. The numbers are the part worth testing,
 * and they can be tested without rendering anything.
 *
 * See docs/superpowers/specs/2026-08-18-print-zoom-and-colourways-design.md.
 */

/** How much of the lightbox's width the print should try to fill. */
export const TARGET_PRINT_FRACTION = 0.62;

/**
 * How far the photograph may be drawn past its own pixels.
 *
 * The plate is a separate layer over the photograph rather than baked into it,
 * so magnifying redraws the type crisp from its own source and only the fabric
 * behind it softens. That is the trade that makes this work at all. Three
 * times is where the fabric stops reading as a close-up photograph and starts
 * reading as a blown-up image.
 */
export const MAX_UPSCALE = 3;

export interface PlateCentre {
  /** % across the photograph. */
  x: number;
  /** % down the photograph. */
  y: number;
}

/**
 * Where the middle of the plate sits on the photograph.
 *
 * COMPUTED, NOT HARDCODED, because it differs per product, per colourway and
 * per side, and getting it wrong frames the fabric above or below the print
 * rather than the print.
 *
 * The subtle half is the vertical. A plate is placed by its WIDTH alone
 * (`placementFor` gives top, left and width, and the height follows from the
 * artwork), so its height has to be recovered from the two shapes before its
 * centre can be found. A plate that is 46% of the width is only 46% of the
 * height if the plate and the photograph happen to be the same shape, and they
 * never are: the back plates are 0.800 and 0.833 against photographs running
 * 0.800 to 1.260.
 *
 * Pass the placement for the colourway being shown, from `placementFor`, and
 * that colourway's photo shape. The two are a pair: the tee's landscape shots
 * have their own placement because the tee fills less of the frame.
 */
export function plateCentre(
  placement: PlatePlacement,
  photoAspect: number,
  plateAspect: number,
): PlateCentre {
  const heightPct = (placement.width * photoAspect) / plateAspect;
  return {
    x: placement.left + placement.width / 2,
    y: placement.top + heightPct / 2,
  };
}

/**
 * How far to zoom so the print fills its share of the lightbox.
 *
 * A FRACTION OF THE BOX, NOT A FIXED MULTIPLIER. That single choice is what
 * lets one constant serve both sides and every screen. The chest badge is 13%
 * of the garment's width and the back plate is 46%, so the same target asks
 * for 4.8x of one and 1.35x of the other with no special case: clicking the
 * back opens something close to the whole garment and clicking the front opens
 * tight on the chest, and that falls out of the arithmetic rather than an `if`.
 *
 * It is also why there is no mobile breakpoint. A phone's box is smaller, so
 * the same fraction is reached at the same scale, and the ceiling below simply
 * stops binding because there are fewer box pixels to fill per source pixel.
 */
export function zoomScale({
  plateWidthPct,
  photoWidth,
  boxWidth,
  photoSourceWidth,
  target = TARGET_PRINT_FRACTION,
  maxUpscale = MAX_UPSCALE,
}: {
  /** The plate's width as a % of the photograph, or null for a view with no print. */
  plateWidthPct: number | null;
  /**
   * The photograph's DRAWN width in the lightbox, before scaling.
   *
   * NOT the same as boxWidth, and conflating the two is a bug that survives
   * review because the numbers look plausible. The box is landscape when it
   * frames a print and the photographs are portrait, so the photograph is
   * height-constrained inside it: at 88vh on a 1280x800 screen the box is 845
   * wide and the photograph in it is 563. The plate is a percentage of the
   * PHOTOGRAPH, so the plate's on-screen size is a fraction of this number,
   * while the share of the lightbox it fills is measured against boxWidth.
   */
  photoWidth: number;
  /** The lightbox's own width in CSS pixels. Zero before it has been measured. */
  boxWidth: number;
  /** The photograph's width in real pixels, on disk. */
  photoSourceWidth: number;
  target?: number;
  maxUpscale?: number;
}): number {
  if (
    !plateWidthPct ||
    photoWidth <= 0 ||
    boxWidth <= 0 ||
    photoSourceWidth <= 0
  ) {
    return 1;
  }
  // How far to scale so the plate covers `target` of the BOX. The plate starts
  // at plateWidthPct of the PHOTOGRAPH, hence a photoWidth denominator against
  // a boxWidth numerator.
  const wanted = (target * boxWidth) / ((plateWidthPct / 100) * photoWidth);
  // The photograph is the thing being stretched, so the ceiling is measured
  // against it too.
  const ceiling = (maxUpscale * photoSourceWidth) / photoWidth;
  // Never below 1: a small source in a large box would otherwise shrink the
  // garment inside its own lightbox, which is the opposite of the request.
  return Math.max(1, Math.min(wanted, ceiling));
}
