/**
 * Imports garment photography from "Stock Images/" into public/garments/.
 *
 * WHY THIS EXISTS. The owner uploads full-size PNGs, 1 to 3 MB each, into a
 * folder with spaces in its name that sits outside public/ and so cannot be
 * served. This normalises the names, resizes, converts to WebP and writes them
 * where Next can serve them.
 *
 * USAGE
 *
 *   node scripts/import-garments.mjs
 *   node scripts/import-garments.mjs --force    # redo files that already exist
 *
 * It is safe to run repeatedly. Existing outputs are skipped unless --force,
 * so it can be run again each time more photography is uploaded without
 * reprocessing the whole set.
 *
 * NAMING. Source files are named loosely: "Hoodie-Blue-back.png" and
 * "Crewneck - peach - back.png" both occur. The parser lowercases, splits on
 * hyphens and spaces, and takes the first token as the product, the last as the
 * view and whatever is between as the colour, ignoring the word "premium".
 * Output is always public/garments/<product>/<colour>/<view>.webp.
 */

import { readdir, mkdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const SOURCE_DIRS = ["Stock Images", "Stock Images "]; // trailing space seen in the wild
const OUT = path.join(ROOT, "public", "garments");

/** Long edge in pixels. 1400 is ample for a product page at 2x on mobile. */
const MAX_EDGE = 1400;
/** WebP quality. 82 is visually lossless for flat product photography. */
const QUALITY = 82;

const FORCE = process.argv.includes("--force");

/** Words that appear in file names and carry no meaning. */
const NOISE = new Set(["premium", "unisex", "woman", "women", "mens", "men", ""]);

/** The views we recognise. Anything else is skipped with a warning. */
const VIEWS = new Set(["front", "back", "profile", "fleece"]);

function parseName(file) {
  const base = path.basename(file, path.extname(file));
  const parts = base
    .toLowerCase()
    .split(/[-_\s]+/)
    .map((p) => p.trim())
    .filter((p) => p !== "" && !NOISE.has(p));

  if (parts.length < 3) return null;

  const product = parts[0] === "hoodies" ? "hoodie" : parts[0];
  const view = parts[parts.length - 1];
  const colour = parts.slice(1, -1).join("-");

  if (!VIEWS.has(view) || colour === "") return null;
  return { product, colour, view };
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (/\.(png|jpe?g|webp)$/i.test(entry.name)) yield full;
  }
}

async function main() {
  const source = SOURCE_DIRS.map((d) => path.join(ROOT, d)).find((d) =>
    existsSync(d),
  );
  if (!source) {
    console.error(`No source folder found. Looked for: ${SOURCE_DIRS.join(", ")}`);
    process.exit(1);
  }

  let written = 0;
  let skipped = 0;
  let unparsed = 0;
  let bytesIn = 0;
  let bytesOut = 0;

  for await (const file of walk(source)) {
    const parsed = parseName(file);
    if (!parsed) {
      console.warn(`  ? could not read a product, colour and view from: ${path.basename(file)}`);
      unparsed += 1;
      continue;
    }

    const { product, colour, view } = parsed;
    const dir = path.join(OUT, product, colour);
    const out = path.join(dir, `${view}.webp`);

    if (existsSync(out) && !FORCE) {
      skipped += 1;
      continue;
    }

    await mkdir(dir, { recursive: true });
    await sharp(file)
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toFile(out);

    bytesIn += (await stat(file)).size;
    bytesOut += (await stat(out)).size;
    written += 1;
    console.log(`  + ${product}/${colour}/${view}.webp`);
  }

  const mb = (n) => (n / 1024 / 1024).toFixed(1);
  console.log(
    `\n${written} written, ${skipped} already present, ${unparsed} unreadable`,
  );
  if (written > 0) {
    console.log(`${mb(bytesIn)} MB in, ${mb(bytesOut)} MB out`);
  }
  console.log(
    `\nColours found: run \`ls public/garments/*\` and make products.ts match. ` +
      `A swatch with no photograph behind it must never ship.`,
  );
}

await main();
