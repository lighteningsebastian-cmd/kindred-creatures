import { Path, type PathCommand } from "opentype.js";
import { loadPrintFont, type PrintFontRole } from "./fonts";

/**
 * Setting type as outlines, which is the whole reason the compositor exists.
 *
 * Two things are allowed to put marks on a garment: the image model draws the
 * animal, and this file draws every letter. Nothing else. Models cannot spell
 * (the owner's first mockup read KINDBED CREATURES in two panels of four) and
 * font substitution in a serverless rasteriser is silent, so both routes to
 * text on fabric are closed and replaced with glyph outlines we compute here.
 *
 * Everything is laid out with the baseline on y = 0 starting at x = 0. The
 * caller positions the run; these functions only shape it.
 */

/** A run of text, converted to outlines and measured. */
export interface OutlinedText {
  /** SVG path data. Contains outlines only, never a font reference. */
  d: string;
  /**
   * Advance width in px, excluding any trailing letterspacing. This is what to
   * centre or right-align against.
   */
  width: number;
  /** Baseline to the top of the face, positive upward. */
  ascent: number;
  /** Baseline to the bottom of the face, positive downward. */
  descent: number;
}

export interface OutlineOptions {
  role: PrintFontRole;
  sizePx: number;
  /**
   * Extra space between glyphs in px. The plate leans on this heavily: the
   * wordmark and the table labels are defined by their letterspacing as much as
   * by their face.
   */
  letterSpacingPx?: number;
}

/** Where one glyph ended up on an arc, and how far it was turned. */
export interface ArcGlyphPlacement {
  char: string;
  /** Position around the circle in radians, SVG axes, 0 along +x. */
  angleRad: number;
  /** Baseline origin of the glyph, on the circle. */
  x: number;
  y: number;
  /** Rotation applied to the glyph. Equal to the tangent direction at x,y. */
  rotationRad: number;
  /** This glyph's advance in px. */
  advance: number;
}

export interface OutlinedArcText extends OutlinedText {
  /** Per glyph placement, exposed so the geometry can be asserted, not eyeballed. */
  glyphs: ArcGlyphPlacement[];
  /** Angle the whole run subtends, radians. */
  spanRad: number;
}

export interface ArcOutlineOptions extends OutlineOptions {
  radiusPx: number;
  centreX: number;
  centreY: number;
}

/** Coordinate precision in path data. At 300 DPI a thousandth of a px is noise. */
const PRECISION = 3;

/**
 * Apply an affine transform to a glyph's commands.
 *
 * The transform is baked into the coordinates rather than emitted as an SVG
 * `transform` attribute, so the result is one flat path that cannot be
 * misassembled downstream and needs no attribute support from the rasteriser.
 */
function transformCommands(
  commands: PathCommand[],
  map: (x: number, y: number) => { x: number; y: number },
): PathCommand[] {
  return commands.map((command) => {
    const next = { ...command } as PathCommand & {
      x?: number;
      y?: number;
      x1?: number;
      y1?: number;
      x2?: number;
      y2?: number;
    };
    if (typeof next.x === "number" && typeof next.y === "number") {
      const p = map(next.x, next.y);
      next.x = p.x;
      next.y = p.y;
    }
    if (typeof next.x1 === "number" && typeof next.y1 === "number") {
      const p = map(next.x1, next.y1);
      next.x1 = p.x;
      next.y1 = p.y;
    }
    if (typeof next.x2 === "number" && typeof next.y2 === "number") {
      const p = map(next.x2, next.y2);
      next.x2 = p.x;
      next.y2 = p.y;
    }
    return next;
  });
}

/** Advances and kerning for a string, in px, in one pass. */
function measureGlyphs(
  text: string,
  { role, sizePx, letterSpacingPx = 0 }: OutlineOptions,
) {
  const font = loadPrintFont(role);
  const scale = sizePx / font.unitsPerEm;

  // Deliberately NOT font.stringToGlyphs. That runs opentype's shaping engine,
  // which throws on Archivo ("substitutionType : 62 lookupType: 6 - substFormat:
  // 2 is not yet supported"). Mapping characters directly also removes automatic
  // ligature and contextual substitution, which is a gain here rather than a
  // loss: the plate must lay out identically on every order, and kerning still
  // applies below. Array.from splits by code point, so an astral character in a
  // pet's name stays one glyph.
  const characters = Array.from(text);
  const glyphs = characters.map((char) => font.charToGlyph(char));

  const measured = glyphs.map((glyph, index) => {
    // Kerning is the difference between type that was set and type that was
    // typed. It costs one lookup per pair.
    const previous = index > 0 ? glyphs[index - 1] : undefined;
    const kerning = previous ? font.getKerningValue(previous, glyph) * scale : 0;
    return {
      glyph,
      char: characters[index] ?? "",
      advance: (glyph.advanceWidth ?? 0) * scale,
      kerning,
    };
  });

  // Letterspacing sits BETWEEN glyphs, so a run of n glyphs has n-1 gaps.
  // Counting a trailing gap would push every centred line off centre by half a
  // space, which is exactly the kind of error nobody sees until it is printed.
  const width =
    measured.reduce((sum, m) => sum + m.advance + m.kerning, 0) +
    letterSpacingPx * Math.max(0, measured.length - 1);

  return {
    font,
    measured,
    width,
    ascent: font.ascender * scale,
    descent: Math.abs(font.descender * scale),
  };
}

/**
 * A straight run of text, outlined.
 *
 * @returns outlines with the baseline on y = 0, starting at x = 0.
 */
export function outlineText(
  text: string,
  options: OutlineOptions,
): OutlinedText {
  const { letterSpacingPx = 0, sizePx } = options;
  const { measured, width, ascent, descent } = measureGlyphs(text, options);

  const combined = new Path();
  let x = 0;
  for (const { glyph, advance, kerning } of measured) {
    x += kerning;
    combined.extend(glyph.getPath(x, 0, sizePx).commands);
    x += advance + letterSpacingPx;
  }

  return { d: combined.toPathData(PRECISION), width, ascent, descent };
}

/**
 * A run of text set on a true circular arc, curving upward.
 *
 * Each glyph is placed at its own point on the circle and turned to that
 * point's TANGENT, with the spacing advanced along the arc rather than along a
 * straight line. The spec forbids the cheap version of this, where whole glyph
 * boxes are rotated by a shared angle, because it reads as a ransom note at the
 * ends of the run where the error is largest.
 *
 * The run is centred on the top of the circle, so the caller places the circle
 * centre BELOW the portrait and gets a rainbow.
 *
 * @returns outlines plus the placement of every glyph, so the geometry is
 * testable rather than a matter of opinion.
 */
export function outlineTextOnArc(
  text: string,
  options: ArcOutlineOptions,
): OutlinedArcText {
  const {
    letterSpacingPx = 0,
    sizePx,
    radiusPx,
    centreX,
    centreY,
  } = options;
  const { measured, width, ascent, descent } = measureGlyphs(text, options);

  // Arc length maps to angle by dividing through the radius, so the run
  // subtends a wider angle on a tighter curve. Centring on the top of the
  // circle means half the span sits either side of straight up.
  const spanRad = width / radiusPx;
  const startAngle = -Math.PI / 2 - spanRad / 2;

  const combined = new Path();
  const glyphs: ArcGlyphPlacement[] = [];
  let travelled = 0;

  for (const { glyph, char, advance, kerning } of measured) {
    travelled += kerning;

    // Turn the glyph about its own middle, so it sits square on the curve
    // rather than pivoting from its left edge.
    const centreOffset = travelled + advance / 2;
    const angleRad = startAngle + centreOffset / radiusPx;
    const x = centreX + radiusPx * Math.cos(angleRad);
    const y = centreY + radiusPx * Math.sin(angleRad);
    // The tangent of a circle runs a quarter turn ahead of the radius.
    const rotationRad = angleRad + Math.PI / 2;

    const cos = Math.cos(rotationRad);
    const sin = Math.sin(rotationRad);
    const half = advance / 2;

    combined.extend(
      transformCommands(glyph.getPath(0, 0, sizePx).commands, (gx, gy) => {
        // Centre the glyph on the arc point, turn it to the tangent, then move
        // it out to the circle.
        const lx = gx - half;
        return {
          x: x + (lx * cos - gy * sin),
          y: y + (lx * sin + gy * cos),
        };
      }),
    );

    glyphs.push({ char, angleRad, x, y, rotationRad, advance });
    travelled += advance + letterSpacingPx;
  }

  return {
    d: combined.toPathData(PRECISION),
    width,
    ascent,
    descent,
    glyphs,
    spanRad,
  };
}

/**
 * Wrap outlined paths in an SVG document sized to the plate.
 *
 * There is no background rectangle and there never may be. The plate prints
 * straight onto the garment colour, so anything opaque behind the artwork
 * prints as a rectangle of ink around it.
 */
export function svgDocument(
  widthPx: number,
  heightPx: number,
  body: string,
): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" ` +
    `height="${heightPx}" viewBox="0 0 ${widthPx} ${heightPx}">${body}</svg>`
  );
}

/** One outlined run as a fillable SVG element. */
export function pathElement(d: string, fill: string): string {
  return `<path d="${d}" fill="${fill}"/>`;
}
