import sharp from "sharp";
import {
  SPECIES,
  binomialFor,
  breedRowValue,
  getBreed,
  temperamentLabel,
} from "@/lib/breeds";
import type { CompanionProfile } from "@/lib/companion";
import {
  outlineText,
  outlineTextOnArc,
  pathElement,
  svgDocument,
  type OutlinedText,
} from "./text-to-path";
import type { PrintFontRole } from "./fonts";

/**
 * The composited garment plate: front and back.
 *
 * THE MODEL DRAWS THE ANIMAL AND NOTHING ELSE. Every letter, rule and table row
 * here is typeset by us and laid around a portrait with a transparent
 * background. Image models cannot spell, and a misspelt garment is not
 * recoverable once it is printed. See docs/spec-print-layout.md.
 *
 * Both plates are laid out in the target pixel space directly and rasterised at
 * the product's 300 DPI print area. The type is vector outlines, so it is sharp
 * at full resolution however small the portrait behind it happens to be.
 */

/** bark-900, the design system's warm brown-black. The plate's single ink. */
export const INK = "#241b13";

/**
 * Everything on the plate is drawn in one tone. Dark colourways need the whole
 * plate inverted, type included, and that is deliberately NOT built until the
 * printer says how dark garments are handled: a tint of the dark plate is not
 * the same artwork, and guessing costs a print run. This parameter is the seam.
 */
export type Ink = typeof INK;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PlateLayout {
  /** The type layer. Outlines only, transparent, no background. */
  svg: string;
  /** Where the portrait goes, underneath the type. */
  portrait: Rect;
}

/**
 * Sets a line at the given size, shrunk if it would run wider than the plate.
 *
 * Everything on a plate is set from customer data, so every line has a worst
 * case: a long breed name, a long binomial. Type that overflows the print area
 * is clipped by the press, and nobody sees it until the garment arrives.
 */
function fitToWidth(
  text: string,
  role: PrintFontRole,
  sizePx: number,
  trackingRatio: number,
  maxWidth: number,
): OutlinedText {
  const first = outlineText(text, {
    role,
    sizePx,
    letterSpacingPx: sizePx * trackingRatio,
  });
  if (first.width <= maxWidth) return first;

  const scaled = sizePx * (maxWidth / first.width);
  return outlineText(text, {
    role,
    sizePx: scaled,
    letterSpacingPx: scaled * trackingRatio,
  });
}

/** A solid rule, drawn as a path so the plate is nothing but outlines. */
function rule(x0: number, x1: number, y: number, thickness: number): string {
  return `M${x0} ${y}H${x1}V${y + thickness}H${x0}Z`;
}

/**
 * The front: an arc, a portrait, and their name. Small, left chest.
 *
 * With no name the remaining two elements recentre rather than leaving a gap
 * where a line would have been. A blank line reads as a mistake on a garment.
 */
export function frontPlate(
  profile: CompanionProfile,
  width: number,
  height: number,
  ink: Ink = INK,
): PlateLayout {
  const margin = width * 0.06;
  const contentWidth = width - margin * 2;

  const wordSize = contentWidth * 0.062;
  const nameSize = contentWidth * 0.115;
  const gap = contentWidth * 0.05;

  // ALL CAPS, matching the back. Owner decision, 3 August; the spec has said so
  // since and the code simply had not followed.
  //
  // Caps are meaningfully wider than sentence case, so the name is shrunk to fit
  // exactly as the back's heading is. BARTHOLOMEW at 110mm is the case that
  // decides this, and a name clipped by the press is not discovered until the
  // garment arrives.
  const name = profile.name?.trim().toUpperCase() ?? "";
  const nameRun = name
    ? fitToWidth(name, "frontName", nameSize, 0, contentWidth)
    : null;

  // Measure the arc before placing anything: its cap height decides how much
  // room the stack needs above the portrait.
  const probe = outlineText("KINDRED CREATURES", {
    role: "wordmarkFront",
    sizePx: wordSize,
    letterSpacingPx: wordSize * 0.28,
  });

  // The name block is measured to its DESCENDERS, not just its baseline. A
  // name has to sit whole inside the plate: the tail of a "y" clipped by the
  // edge of the print area is not something anyone checks for until it is on a
  // garment.
  const nameBlock = nameRun ? gap + nameRun.ascent + nameRun.descent : 0;
  const arcBlock = probe.ascent + gap;

  const portraitSize = Math.min(contentWidth, height - arcBlock - nameBlock);
  const stackHeight = arcBlock + portraitSize + nameBlock;
  const top = (height - stackHeight) / 2;

  const portraitTop = top + arcBlock;
  const centreX = width / 2;
  const centreY = portraitTop + portraitSize / 2;
  // The arc's baseline sits just outside the portrait; glyphs grow outward from
  // it, so the wordmark curves over the top like a rainbow.
  const radius = portraitSize / 2 + gap * 0.35;

  const arc = outlineTextOnArc("KINDRED CREATURES", {
    // SemiBold here, Light on the back. The front arc is small and widely
    // letterspaced, and Light at that size disappears into the portrait.
    role: "wordmarkFront",
    sizePx: wordSize,
    letterSpacingPx: wordSize * 0.28,
    radiusPx: radius,
    centreX,
    centreY,
  });

  const parts = [pathElement(arc.d, ink)];

  if (nameRun) {
    const baseline = portraitTop + portraitSize + gap + nameRun.ascent;
    parts.push(
      `<g transform="translate(${centreX - nameRun.width / 2} ${baseline})">` +
        `${pathElement(nameRun.d, ink)}</g>`,
    );
  }

  return {
    svg: svgDocument(width, height, parts.join("")),
    portrait: {
      x: centreX - portraitSize / 2,
      y: portraitTop,
      width: portraitSize,
      height: portraitSize,
    },
  };
}

/** One row of the data table. Rows without a value never reach here. */
interface TableRow {
  label: string;
  value: string;
}

/**
 * The heading above the portrait: what this creature IS, in caps.
 *
 * This is where the breed word lives now. It used to be printed twice, once
 * here and once in a BREED table row, which on a plate this spare reads as a
 * fault rather than a fact (owner, 5 August). The table lost the row; the
 * heading keeps the word, and every route to a breed word ends here:
 *
 * - a breed from our table, or `One of One` for an unrecorded one
 * - a breed the customer typed, because ours did not have it
 * - an "other" species' own word for what their animal is
 *
 * `COMPANION PROFILE` is the last resort, for a plate with no breed word at
 * all. That is a real state (an "other" species who named the kind and not the
 * breed) and the SPECIES row carries the answer in that case.
 */
export function plateHeading(profile: CompanionProfile): string {
  const breed = profile.breedId ? getBreed(profile.breedId) : undefined;
  if (breed) return breedRowValue(breed).toUpperCase();

  const typed = profile.otherBreed?.trim();
  if (typed) return typed.toUpperCase();

  return "COMPANION PROFILE";
}

/**
 * The rows for a profile, in the fixed order, with empties dropped.
 *
 * THREE ROWS AT MOST: ORIGIN, GROUP, TOGETHER. Owner decision, 5 August:
 * anything more is too busy. What left, and why:
 *
 * - BREED, because it is already printed in caps directly above the portrait
 *   as the plate's heading. Once is a fact, twice is a fault.
 * - TEMPERAMENT, which moved out from under a label and sits under the portrait
 *   as a line of its own. See backPlate.
 *
 * TOGETHER SINCE became TOGETHER: the owner's wording, and the shorter label.
 * Whatever it is called it must never read as a lifespan, so EST., BORN and
 * LIFE stay forbidden (docs/spec-print-layout.md section 3). TOGETHER is safe.
 *
 * The table closes up rather than printing a blank, and it is allowed to come
 * back EMPTY: a customer who typed their own breed and gave no year has their
 * word in the heading and nothing left for a row. The rule above and the name
 * below carry the plate on their own.
 */
export function tableRows(profile: CompanionProfile): TableRow[] {
  const rows: TableRow[] = [];
  const breed = profile.breedId ? getBreed(profile.breedId) : undefined;

  if (profile.species === "other") {
    // Two named answers onto two named rows. Their word for the BREED is the
    // heading now, the same as it is for every other species.
    const push = (label: string, value: string | null) => {
      const trimmed = value?.trim();
      if (trimmed) rows.push({ label, value: trimmed });
    };
    push("SPECIES", profile.otherKind);
    push("ORIGIN", profile.otherOrigin);
  } else if (breed) {
    const config = SPECIES[breed.species];
    if (breed.origin) {
      rows.push({ label: config.originLabel, value: breed.origin });
    }
    // An unrecorded breed carries "One of One" as its group too, and the
    // heading right above the portrait already says it. Printing the same
    // words twice on a plate this spare reads as a fault.
    if (
      breed.group &&
      config.groupLabel &&
      breed.group !== breedRowValue(breed)
    ) {
      rows.push({ label: config.groupLabel, value: breed.group });
    }
  }
  // A breed the customer typed themselves adds no row at all. We know what they
  // call their dog, not where the line came from, and inventing an ORIGIN or a
  // GROUP would be the one dishonest row on an honest plate. Their word is
  // already the heading.

  // The only date on the plate, and it lives here rather than under the name.
  // A name in caps above a year is a headstone; above a catalogue number it is
  // an archive entry. See docs/spec-print-layout.md section 3.
  if (profile.togetherSince) {
    rows.push({ label: "TOGETHER", value: String(profile.togetherSince) });
  }

  return rows;
}

/**
 * The back: the full catalogue plate.
 *
 * Laid out from both ends inward. The header block is measured down from the
 * top and the table block up from the bottom; the portrait takes whatever is
 * left. That is what lets the table close up cleanly when a row is missing
 * without any of the fixed elements moving.
 */
export function backPlate(
  profile: CompanionProfile,
  reference: string | null,
  width: number,
  height: number,
  ink: Ink = INK,
): PlateLayout {
  const margin = width * 0.08;
  const x0 = margin;
  const x1 = width - margin;
  const contentWidth = x1 - x0;
  const thin = Math.max(1, contentWidth * 0.004);

  const breed = profile.breedId ? getBreed(profile.breedId) : undefined;
  const parts: string[] = [];

  // --- Top block, measured downward.
  const wordSize = contentWidth * 0.055;
  const word = outlineText("KINDRED CREATURES", {
    role: "wordmark",
    sizePx: wordSize,
    // The widest letterspacing on the plate, per the spec.
    letterSpacingPx: wordSize * 0.42,
  });
  let y = margin + word.ascent;
  parts.push(
    `<g transform="translate(${x0 + (contentWidth - word.width) / 2} ${y})">` +
      `${pathElement(word.d, ink)}</g>`,
  );

  y += word.descent + contentWidth * 0.035;
  parts.push(pathElement(rule(x0, x1, y, thin), ink));

  // The breed word, and the ONLY place it is printed now. See plateHeading.
  const heading = plateHeading(profile);
  // Shrink to fit rather than run off the plate. "Staffordshire Bull Terrier" in
  // caps is half again as wide as "Beagle", and a breed name clipped at the edge
  // of the print area is a garment nobody can sell. Measured once at the ideal
  // size, then scaled by whatever it overflows by.
  const headingRun = fitToWidth(heading, "breed", contentWidth * 0.082, 0.04, contentWidth);
  y += contentWidth * 0.07 + headingRun.ascent;
  parts.push(
    `<g transform="translate(${x0 + (contentWidth - headingRun.width) / 2} ${y})">` +
      `${pathElement(headingRun.d, ink)}</g>`,
  );

  const binomial = breed ? binomialFor(breed) : undefined;
  if (binomial) {
    const binRun = fitToWidth(binomial, "binomial", contentWidth * 0.045, 0, contentWidth);
    y += binRun.ascent + contentWidth * 0.012;
    parts.push(
      `<g transform="translate(${x0 + (contentWidth - binRun.width) / 2} ${y})">` +
        `${pathElement(binRun.d, ink)}</g>`,
    );
  }
  const topEnd = y + contentWidth * 0.05;

  // --- Bottom block, measured upward from the foot.
  const refSize = contentWidth * 0.032;
  const refRun = reference
    ? outlineText(reference, {
        role: "label",
        sizePx: refSize,
        letterSpacingPx: refSize * 0.22,
      })
    : null;

  const backNameSize = contentWidth * 0.075;
  const nameText = profile.name?.trim().toUpperCase() ?? "";
  const nameRun = nameText
    ? outlineText(nameText, {
        role: "backName",
        sizePx: backNameSize,
        letterSpacingPx: backNameSize * 0.06,
      })
    : null;

  const rows = tableRows(profile);
  const rowSize = contentWidth * 0.038;
  const rowStep = rowSize * 1.85;

  let footY = height - margin;
  if (refRun) {
    parts.push(
      `<g transform="translate(${x0 + (contentWidth - refRun.width) / 2} ${footY})">` +
        `${pathElement(refRun.d, ink)}</g>`,
    );
    footY -= refRun.ascent + contentWidth * 0.035;
  }
  if (nameRun) {
    parts.push(
      `<g transform="translate(${x0 + (contentWidth - nameRun.width) / 2} ${footY})">` +
        `${pathElement(nameRun.d, ink)}</g>`,
    );
    footY -= nameRun.ascent + contentWidth * 0.055;
  }

  // Rows are drawn bottom-up so the block stays anchored to the foot.
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const row = rows[i]!;
    const label = outlineText(row.label, {
      role: "label",
      sizePx: rowSize,
      letterSpacingPx: rowSize * 0.16,
    });
    const value = outlineText(row.value, { role: "value", sizePx: rowSize });
    parts.push(
      `<g transform="translate(${x0} ${footY})">${pathElement(label.d, ink)}</g>`,
    );
    // Right-aligned to the plate edge, so both columns hold the margins.
    parts.push(
      `<g transform="translate(${x1 - value.width} ${footY})">` +
        `${pathElement(value.d, ink)}</g>`,
    );
    footY -= rowStep;
  }

  footY -= contentWidth * 0.02;
  parts.push(pathElement(rule(x0, x1, footY, thin), ink));

  // --- The temperament, between the portrait and that rule.
  //
  // It was a TEMPERAMENT row in the table until 5 August, when the owner moved
  // it here: centred, joined with a middot, directly under the portrait.
  //
  //                  [ portrait, graphite ]
  //            Confident · Affectionate · Spirited
  //         ─────────────────────────────────
  //
  // Set in the VALUE role at the table's row size, because it is a caption and
  // not a heading: it must not compete with the breed name at the top.
  //
  // Measured upward from the rule like everything else in this block, so the
  // portrait shrinks by exactly the space the line takes. No words chosen means
  // no line AND no gap: the portrait grows back into it and the plate looks as
  // deliberate as it does with three. Same discipline as the name and the year.
  let portraitFloor = footY;
  const traits = profile.temperament.map(temperamentLabel).join(" · ");
  if (traits) {
    // Shrink to fit: three of the longer words joined by middots is a wide line.
    const traitsRun = fitToWidth(traits, "value", rowSize, 0, contentWidth);
    const baseline = footY - contentWidth * 0.035 - traitsRun.descent;
    parts.push(
      `<g transform="translate(${x0 + (contentWidth - traitsRun.width) / 2} ${baseline})">` +
        `${pathElement(traitsRun.d, ink)}</g>`,
    );
    portraitFloor = baseline - traitsRun.ascent;
  }

  return {
    svg: svgDocument(width, height, parts.join("")),
    portrait: {
      x: x0,
      y: topEnd,
      width: contentWidth,
      height: Math.max(0, portraitFloor - contentWidth * 0.04 - topEnd),
    },
  };
}

/**
 * Rasterise a plate: the portrait underneath, the type on top.
 *
 * Transparent throughout. The plate prints straight onto the garment colour, so
 * an opaque background would print as a rectangle of ink around the artwork.
 *
 * @param portraitBytes a transparent PNG. `contain` rather than `fill`, because
 * stretching an animal to fit a box is a wrong-looking dog.
 */
export async function composePlate(
  layout: PlateLayout,
  portraitBytes: Uint8Array | null,
  width: number,
  height: number,
): Promise<Uint8Array> {
  const transparent = { r: 0, g: 0, b: 0, alpha: 0 } as const;
  const layers: sharp.OverlayOptions[] = [];

  if (portraitBytes && layout.portrait.height > 0) {
    const fitted = await sharp(Buffer.from(portraitBytes))
      .resize({
        width: Math.round(layout.portrait.width),
        height: Math.round(layout.portrait.height),
        fit: "contain",
        background: transparent,
      })
      .png()
      .toBuffer();
    layers.push({
      input: fitted,
      left: Math.round(layout.portrait.x),
      top: Math.round(layout.portrait.y),
    });
  }

  layers.push({ input: Buffer.from(layout.svg) });

  const out = await sharp({
    create: { width, height, channels: 4, background: transparent },
  })
    .composite(layers)
    .png()
    .toBuffer();

  return new Uint8Array(out);
}
