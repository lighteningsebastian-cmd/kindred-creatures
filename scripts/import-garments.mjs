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
 *   node --import ./scripts/alias-loader.mjs scripts/import-garments.mjs
 *   node --import ./scripts/alias-loader.mjs scripts/import-garments.mjs --force
 *   node --import ./scripts/alias-loader.mjs scripts/import-garments.mjs --source "/path/to/Stock Images "
 *
 * The loader is needed because the naming rule lives in src/lib/garment-import.ts,
 * where it can be tested. --force redoes files that already exist.
 *
 * --source NAMES THE SHOOT'S FOLDER, and it exists for worktrees. "Stock Images"
 * is gitignored, deliberately: it is large and it is not the source of anything
 * the site builds. So it exists only in the main checkout, and a worktree that
 * needs to re-import has to be pointed at it.
 *
 * It is safe to run repeatedly. Existing outputs are skipped unless --force,
 * so it can be run again each time more photography is uploaded without
 * reprocessing the whole set.
 *
 * NAMING is `parseGarmentFile` in src/lib/garment-import.ts, under test there.
 * Output is public/garments/<product>/<fit>/<colour>/<view>.webp.
 *
 * THE FIT IS A PATH SEGMENT, and that is the whole point of this file's last
 * revision. The fit used to be stripped out of every filename as noise, so the
 * men's and the women's crewneck were written into one directory and the shop
 * sold a Grey "Women's fit" sweater over a photograph of the men's one. Unisex
 * garments take a segment too, so there is one rule rather than two.
 *
 * THE TOTE IS ONE PHOTOGRAPH SERVING TWO VIEWS, which is why the parser returns
 * a LIST of views. That the two files are byte-identical is the honest result,
 * not a bug to deduplicate. Reshoot a printed back and only the parser changes.
 */

import { readdir, mkdir, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { parseGarmentFile } from "@/lib/garment-import";

const ROOT = process.cwd();
const SOURCE_DIRS = ["Stock Images", "Stock Images "]; // trailing space seen in the wild
const OUT = path.join(ROOT, "public", "garments");

/** Long edge in pixels. 1400 is ample for a product page at 2x on mobile. */
const MAX_EDGE = 1400;
/** WebP quality. 82 is visually lossless for flat product photography. */
const QUALITY = 82;

const FORCE = process.argv.includes("--force");

/** The folder named with --source, or null to look beside the project. */
function sourceOverride() {
  const at = process.argv.indexOf("--source");
  return at >= 0 ? (process.argv[at + 1] ?? null) : null;
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
  const override = sourceOverride();
  const candidates = override
    ? [override]
    : SOURCE_DIRS.map((d) => path.join(ROOT, d));
  const source = candidates.find((d) => existsSync(d));
  if (!source) {
    console.error(`No source folder found. Looked for: ${candidates.join(", ")}`);
    process.exit(1);
  }

  let written = 0;
  let skipped = 0;
  let unparsed = 0;
  let bytesIn = 0;
  let bytesOut = 0;

  for await (const file of walk(source)) {
    // RELATIVE TO THE SOURCE ROOT, because the fit is often only in the folder
    // ("Tees Men/Tee - White - front.jpeg" says nothing about fit itself), and
    // an absolute path would let directories above the shoot fold into it.
    const parsed = parseGarmentFile(path.relative(source, file));
    if (!parsed) {
      console.warn(
        `  ? could not read a product, colour and view from: ${path.basename(file)}`,
      );
      unparsed += 1;
      continue;
    }

    const { product, fit, colour, views } = parsed;
    const dir = path.join(OUT, product, fit, colour);

    // Encoded once and written to each view it stands for, which is one view
    // for every garment and two for the tote.
    const wanted = views.filter((view) => {
      const out = path.join(dir, `${view}.webp`);
      if (existsSync(out) && !FORCE) {
        skipped += 1;
        return false;
      }
      return true;
    });
    if (wanted.length === 0) continue;

    await mkdir(dir, { recursive: true });
    const encoded = await sharp(file)
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toBuffer();

    bytesIn += (await stat(file)).size;
    for (const view of wanted) {
      const out = path.join(dir, `${view}.webp`);
      await writeFile(out, encoded);
      bytesOut += (await stat(out)).size;
      written += 1;
      console.log(`  + ${product}/${fit}/${colour}/${view}.webp`);
    }
  }

  const mb = (n) => (n / 1024 / 1024).toFixed(1);
  console.log(
    `\n${written} written, ${skipped} already present, ${unparsed} unreadable`,
  );
  if (written > 0) {
    console.log(`${mb(bytesIn)} MB in, ${mb(bytesOut)} MB out`);
  }
  console.log(
    `\nColours found: run \`ls public/garments/*/*\` and make products.ts match. ` +
      `A swatch with no photograph behind it must never ship.`,
  );
}

await main();
