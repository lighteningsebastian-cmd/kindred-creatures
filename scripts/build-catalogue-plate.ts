/**
 * Renders the demo plate the catalogue cards overlay.
 *
 * ONE DEMO COMPANION, RENDERED BY THE PRODUCTION RENDERERS. backPlate,
 * frontPlate and composePlate are the same functions that make the print file,
 * so a catalogue card cannot advertise a plate we would not print. A copy of
 * the layout here would drift the first time the plate changed.
 *
 * USAGE
 *
 *   node --import ./scripts/alias-loader.mjs scripts/build-catalogue-plate.ts
 *
 * Node 24 runs this file directly (it strips the types); the loader is there
 * only because src/ uses the "@/" alias, and it is not an extra dependency.
 *
 * Output: public/demo/plate-{back-<slug>,front}.png, committed.
 *
 * The back print area differs by product, and the plate is overlaid at its own
 * intrinsic shape, so the back is rendered once per product. The front is
 * FRONT_PRINT everywhere, so it is rendered once.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { backPlate, composePlate, frontPlate } from "../src/lib/print/plate.ts";
import { FRONT_PRINT, PRODUCTS } from "../src/lib/products.ts";
import type { CompanionProfile } from "../src/lib/companion.ts";

/**
 * The demo companion.
 *
 * A real breed rather than One of One, so the plate shows the ORIGIN and GROUP
 * rows filling themselves in — the moment that sells the product. "Alert" is
 * not one of our twelve temperaments (see TEMPERAMENTS in lib/breeds.ts);
 * "watchful" is the same idea in the vocabulary we actually print.
 *
 * These are every field of CompanionProfile as it stands. If the interface has
 * gained one since, the compiler will say so rather than the plate rendering
 * short.
 */
const DEMO: CompanionProfile = {
  name: "Rex",
  species: "dog",
  breedId: "german-shepherd",
  temperament: ["loyal", "watchful", "sleepy"],
  togetherSince: 2020,
  otherKind: null,
  otherBreed: null,
  otherOrigin: null,
};

/** Wide enough to stay crisp on a retina catalogue card, small enough to commit. */
const BACK_WIDTH = 900;
const FRONT_WIDTH = 600;

const PORTRAIT = join(process.cwd(), "assets", "demo-companion.png");
const OUT = join(process.cwd(), "public", "demo");

async function portraitBytes(): Promise<Uint8Array | null> {
  try {
    return new Uint8Array(await readFile(PORTRAIT));
  } catch {
    // Not an error the build should die on: the plate renders with an empty
    // portrait area and the typography is reviewable. But a card MUST NOT
    // SHIP in this state — a finished-looking plate with a hole where the
    // animal belongs is worse than the hatched placeholder it replaces.
    console.warn(
      `\n  !! ${PORTRAIT} is missing. Writing plates with no portrait.\n` +
        `     Do not ship the catalogue in this state.\n`,
    );
    return null;
  }
}

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });
  const portrait = await portraitBytes();

  for (const product of PRODUCTS) {
    if (product.slug === "tote") continue; // deferred, no plate
    const area = product.printArea.back;
    const height = Math.round((BACK_WIDTH * area.heightMm) / area.widthMm);
    const layout = backPlate(DEMO, null, BACK_WIDTH, height);
    const png = await composePlate(layout, portrait, BACK_WIDTH, height);
    const path = join(OUT, `plate-back-${product.slug}.png`);
    await writeFile(path, png);
    console.log(`  ${path}  ${BACK_WIDTH}x${height}`);
  }

  const frontHeight = Math.round(
    (FRONT_WIDTH * FRONT_PRINT.heightMm) / FRONT_PRINT.widthMm,
  );
  const front = frontPlate(DEMO, FRONT_WIDTH, frontHeight);
  const frontPng = await composePlate(front, portrait, FRONT_WIDTH, frontHeight);
  await writeFile(join(OUT, "plate-front.png"), frontPng);
  console.log(`  ${join(OUT, "plate-front.png")}  ${FRONT_WIDTH}x${frontHeight}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
