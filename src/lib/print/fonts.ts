import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse, type Font } from "opentype.js";

/**
 * The typefaces the garment plate is set in, loaded as real font binaries.
 *
 * WHY THE FILES ARE VENDORED IN `assets/fonts/` RATHER THAN COMING FROM
 * `next/font/google`: next/font emits SUBSETTED woff2 into `.next/` at build
 * time, containing only the glyphs the website happens to render. A pet called
 * Zoë or a breed from Sankt Bernhard would come back with holes in it. The
 * print path needs whole fonts, so it reads whole fonts.
 *
 * WHY WE OUTLINE RATHER THAN NAME A FONT IN THE SVG: sharp rasterises SVG
 * through librsvg, which resolves `font-family` against fonts installed on the
 * MACHINE. A serverless container has almost none, so a missing face is
 * silently substituted and the layout reflows. It would look perfect in local
 * development, where the font is installed, and arrive wrong on the garment.
 * See docs/spec-print-layout.md section 4.
 */

/**
 * A typographic job on the plate, not a file name.
 *
 * Callers ask for the role they are setting; the mapping to a face lives here
 * so that changing, say, the breed name from SemiBold to Regular is one edit in
 * one place rather than a hunt through the layout code.
 */
export type PrintFontRole =
  /** `KINDRED CREATURES`, both sides. Light, and very widely letterspaced. */
  | "wordmark"
  /** Data table labels and the `KC-XXXXX` reference. Caps, letterspaced, small. */
  | "label"
  /** Data table values. */
  | "value"
  /** The breed name above the portrait on the back. Caps. */
  | "breed"
  /** The Latin binomial. The one italic on the plate. */
  | "binomial"
  /** The pet's name on the front. Sentence case, and deliberately so. */
  | "frontName"
  /** The pet's name at the foot of the back plate. Caps, centred. */
  | "backName";

const FONT_FILES: Record<PrintFontRole, string> = {
  wordmark: "Archivo-Light.ttf",
  label: "Archivo-Regular.ttf",
  value: "Archivo-Regular.ttf",
  breed: "Archivo-SemiBold.ttf",
  binomial: "EBGaramond-Italic.ttf",
  frontName: "YoungSerif-Regular.ttf",
  backName: "YoungSerif-Regular.ttf",
};

/**
 * Where the font binaries live, resolved from the project root.
 *
 * DEPLOYMENT TRAP, READ BEFORE CHANGING: Next only ships files it can trace
 * statically, and a path built at runtime is invisible to that tracer. Without
 * the matching `outputFileTracingIncludes` entry in `next.config.ts`, these
 * files are simply absent from the serverless bundle and every plate render
 * fails in production while passing every test locally. If you move this
 * directory, move the config glob with it.
 */
const FONT_DIR = join(process.cwd(), "assets", "fonts");

/** Parsed fonts are immutable and reused; parsing a TTF per glyph run is waste. */
const cache = new Map<PrintFontRole, Font>();

/**
 * The parsed font for a role.
 *
 * Throws, loudly and by name, if the file is missing. That is deliberate: the
 * failure this guards against is a font quietly not being there, and a thrown
 * error naming the path is worth more than a garment printed in whatever
 * librsvg fell back to.
 */
export function loadPrintFont(role: PrintFontRole): Font {
  const cached = cache.get(role);
  if (cached) return cached;

  const file = FONT_FILES[role];
  const path = join(FONT_DIR, file);

  let bytes: Buffer;
  try {
    bytes = readFileSync(path);
  } catch (cause) {
    throw new Error(
      `Print font missing for role "${role}": ${path}. If this is a deployed ` +
        `environment, check outputFileTracingIncludes in next.config.ts still ` +
        `covers assets/fonts.`,
      { cause },
    );
  }

  // Node may hand back a Buffer that is a view onto a larger pool, so slice to
  // this file's own bytes before handing opentype an ArrayBuffer.
  const font = parse(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
  cache.set(role, font);
  return font;
}
