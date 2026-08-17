# Catalogue Photography Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put real garment photography on the home page and `/shop`, several aspects per product, with the demo print composited onto the garment by the same placement maths the customizer uses.

**Architecture:** A new `src/lib/garment-shots.ts` owns the catalogue's question ("which pictures does a card show, in what order") and imports placement from the existing `src/lib/garments.ts`, which owns the print question ("where does ink go"). A build-time script renders the demo plate once into `public/demo/` using the production plate renderers. A single `<GarmentShots>` client component draws a shot, overlays the plate by percentage, lifts the white studio background to parchment with `mix-blend-mode`, and swaps views on hover or dot press. Both grids call it.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, `sharp` (build-time plate rasterising), `motion` (existing reveal/transition idiom), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-17-catalogue-photography-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/garments.ts` (modify) | Print placement. Gains per-view photo shapes; `GarmentView` type added and exported. |
| `src/lib/garments.test.ts` (modify) | Extend the shape test to every view, not just `front`. |
| `src/lib/garment-shots.ts` (create) | The catalogue manifest: hero colourway, view order, alt text, `printed` flag, per-product demo plate URL. |
| `src/lib/garment-shots.test.ts` (create) | Manifest cannot drift from the shoot. |
| `scripts/alias-loader.mjs` (create) | Resolve hook so a plain `node scripts/*.ts` can import `src/` modules that use the `@/` alias or extensionless specifiers. |
| `scripts/build-catalogue-plate.ts` (create) | Renders the demo plate PNGs into `public/demo/` using `backPlate`/`frontPlate`/`composePlate`. |
| `src/components/products/GarmentShots.tsx` (create) | The card's image area: parchment lift, plate overlay, hover/dot swap. |
| `src/components/products/GarmentShots.test.tsx` (create) | Swap behaviour, alt text, dot count, accessibility. |
| `src/components/shop/CatalogueCard.tsx` (modify) | Drops `catalogueShot`, renders `<GarmentShots>`. |
| `src/components/sections/ProductRange.tsx` (modify) | Drops `tileShot`, renders `<GarmentShots>`. |
| `src/components/products/LivePreview.tsx` (modify) | Passes `side` to `photoAspect` — this is the `tee/olive` fix reaching the customizer. |
| `src/app/shop/page.tsx` (modify) | Adds the stand-in disclosure beneath the grid, once. |

---

## Task 1: Per-view photo shapes

`PHOTO_SHAPE` records one shape per colourway, but the files disagree by view: `tee/olive` front is 1.333 and back is 1.250. Plate placement is a percentage of the photograph, so the back plate on that colourway is currently measured against a box that is not the picture. The existing test missed it because it only checks `front`.

**Files:**
- Modify: `src/lib/garments.ts:13` (add `GarmentView`), `src/lib/garments.ts:52-73` (`PHOTO_SHAPE`, `photoAspect`)
- Modify: `src/lib/garments.test.ts:57-78`
- Modify: `src/components/products/LivePreview.tsx:65,116`

- [ ] **Step 1: Write the failing test**

Replace the existing `"knows each photograph's real shape, measured from the file"` test in `src/lib/garments.test.ts` with this. Note the added `GARMENT_VIEWS` import and the per-view loop.

```ts
  it("knows every photograph's real shape, per view, measured from the file", async () => {
    // THE BUG THIS PREVENTS. Plate placement is a percentage of the
    // photograph, so the box the photo is drawn in has to BE the photograph's
    // shape; if it is not, the picture is letterboxed while the plate keeps
    // measuring itself against the box, and the plate lands beside the garment
    // instead of on it.
    //
    // PER VIEW, not just per colourway. The shoot varies by both: tee/olive's
    // front is 1.333 and its back is 1.250, and the earlier version of this
    // test only looked at the front, so the back plate on that colourway was
    // being placed against the wrong shape.
    for (const product of PRODUCTS) {
      if (product.slug === "tote") continue;
      for (const variant of product.variants) {
        for (const view of GARMENT_VIEWS) {
          const url = garmentViewUrl(product.slug, variant.color, view);
          if (!url) continue; // not every garment has a fleece detail
          const meta = await sharp(join(PUBLIC, url)).metadata();
          expect(
            photoAspect(product.slug, variant.color, view),
            `${product.slug}/${variant.color}/${view} is ${meta.width}x${meta.height}`,
          ).toBeCloseTo(meta.width! / meta.height!, 2);
        }
      }
    }
  });

  it("reports the front and back shapes of tee/olive as the different numbers they are", () => {
    // The regression guard for the bug above, named explicitly so that a future
    // simplification back to one-shape-per-colourway fails loudly.
    expect(photoAspect("tee", "Olive", "front")).toBeCloseTo(1.333, 2);
    expect(photoAspect("tee", "Olive", "back")).toBeCloseTo(1.25, 2);
  });
```

Update the import block at the top of the same file:

```ts
import {
  GARMENT_VIEWS,
  PLACEMENT,
  garmentImageUrl,
  garmentPhoto,
  garmentViewUrl,
  photoAspect,
  unphotographedColours,
} from "./garments";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/garments.test.ts`
Expected: FAIL — `GARMENT_VIEWS` and `garmentViewUrl` are not exported, so the file does not compile.

- [ ] **Step 3: Write the implementation**

In `src/lib/garments.ts`, replace the `GarmentSide` type declaration (line 13) with:

```ts
/**
 * The two sides a PLATE can be printed on.
 *
 * Deliberately narrower than `GarmentView`. This is the print vocabulary, and
 * every value here has an entry in `PLACEMENT`; widening it to cover a texture
 * crop would let a caller ask where a plate sits on a close-up of fleece.
 */
export type GarmentSide = "front" | "back";

/**
 * Every kind of photograph the shoot produced, plus the on-model shot we do not
 * have yet.
 *
 * A superset of `GarmentSide`: the first two carry print, the rest do not. The
 * catalogue chooses among these (see lib/garment-shots.ts); the customizer only
 * ever asks for a side.
 */
export const GARMENT_VIEWS = [
  "back",
  "front",
  "profile",
  "worn",
  "fleece",
] as const;

export type GarmentView = (typeof GARMENT_VIEWS)[number];
```

Replace `PHOTO_SHAPE` and `photoAspect` (lines 52-73) with:

```ts
/**
 * The shape of each photograph, width over height, keyed by product, colourway
 * AND VIEW.
 *
 * PLACEMENT IS A PERCENTAGE OF THE PHOTOGRAPH, so the box the photo is drawn in
 * has to BE the photograph's shape. Let the box be any other shape and the
 * picture is letterboxed while the plate keeps measuring itself against the
 * box, which puts the plate on the empty space beside the garment.
 *
 * THIS IS PER VIEW AS WELL AS PER COLOURWAY, because the shoot was not
 * consistent in either direction. Per colourway was already necessary: the
 * tee's Heritage Blue and Olive shots are LANDSCAPE while its White is
 * portrait. Per view turned out to be necessary too, and more quietly:
 * tee/olive's front is 1.333 and its back is 1.250, so a single number per
 * colourway placed that garment's back plate against a box six percent wrong.
 * Its profile is 1.501, wrong by a fifth.
 *
 * Measured from the files with sharp, never assumed. Worth reshooting to one
 * ratio per product eventually; until then the code has to tell the truth about
 * what is on disk.
 */
const PHOTO_SHAPE: Record<string, number> = {
  "hoodie/blue/back": 1120 / 1400,
  "hoodie/blue/front": 1120 / 1400,
  "hoodie/blue/profile": 1120 / 1400,
  "hoodie/blue/fleece": 1400 / 1120,
  "hoodie/lilac/back": 1120 / 1400,
  "hoodie/lilac/front": 1120 / 1400,
  "hoodie/lilac/profile": 1120 / 1400,
  "hoodie/lilac/fleece": 1400 / 1120,
  "hoodie/white/back": 1120 / 1400,
  "hoodie/white/front": 1120 / 1400,
  "hoodie/white/profile": 1120 / 1400,
  "hoodie/white/fleece": 1400 / 1120,
  "crewneck/white/back": 1120 / 1400,
  "crewneck/white/front": 1120 / 1400,
  "crewneck/white/profile": 1120 / 1400,
  "crewneck/peach/back": 1120 / 1400,
  "crewneck/peach/front": 1120 / 1400,
  "crewneck/peach/profile": 1120 / 1400,
  "crewneck/grey/back": 1211 / 1299,
  "crewneck/grey/front": 1211 / 1299,
  "crewneck/grey/profile": 1212 / 1297,
  "crewneck/olive/back": 1212 / 1298,
  "crewneck/olive/front": 1212 / 1298,
  "crewneck/olive/profile": 1212 / 1297,
  "tee/white/back": 1144 / 1375,
  "tee/white/front": 1144 / 1375,
  "tee/white/profile": 1313 / 1198,
  "tee/heritage-blue/back": 1400 / 1111,
  "tee/heritage-blue/front": 1400 / 1114,
  "tee/heritage-blue/profile": 1400 / 1117,
  "tee/olive/back": 1400 / 1120,
  "tee/olive/front": 1400 / 1050,
  "tee/olive/profile": 1400 / 933,
};

/** Fallback shape for a garment with no photograph, such as the tote. */
const DEFAULT_SHAPE = 4 / 5;

/**
 * The shape of the photograph shown for a product, colourway and view.
 *
 * The view defaults to "front" so that existing callers asking about a garment
 * in general get the shape they always got.
 */
export function photoAspect(
  slug: ProductSlug,
  color: string,
  view: GarmentView = "front",
): number {
  const photo = garmentPhoto(slug, color);
  if (!photo) return DEFAULT_SHAPE;
  return PHOTO_SHAPE[`${slug}/${photo.dir}/${view}`] ?? DEFAULT_SHAPE;
}
```

Then add `garmentViewUrl` directly below the existing `garmentImageUrl` (which stays exactly as it is, so every current caller is untouched):

```ts
/**
 * The public path to any view of a garment, or null where there is none.
 *
 * The generalisation of `garmentImageUrl` past the two printable sides. Null is
 * a real answer twice over: the tote has no photography at all, and no garment
 * has a `worn` shot yet. Callers must render something sensible rather than an
 * empty image element.
 */
export function garmentViewUrl(
  slug: ProductSlug,
  color: string,
  view: GarmentView,
): string | null {
  const photo = garmentPhoto(slug, color);
  if (!photo) return null;
  if (!(`${slug}/${photo.dir}/${view}` in PHOTO_SHAPE)) return null;
  return `/garments/${slug}/${photo.dir}/${view}.webp`;
}
```

`PHOTO_SHAPE` is now doing double duty as the file manifest, which is why `garmentViewUrl` can answer "is there a fleece shot for the tee" without touching the filesystem. The test in Step 1 is what keeps the two in step.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/garments.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Pass the view through in LivePreview**

This is the fix reaching the customizer. In `src/components/products/LivePreview.tsx`, line 65, inside `frontZoom`:

```ts
  const heightPct =
    ((placement.width * print.heightMm) / print.widthMm) *
    photoAspect(product.slug, color.color, "front");
```

And line 116, the inner box in `GarmentView`:

```ts
        style={{ aspectRatio: photoAspect(product.slug, color.color, side) }}
```

- [ ] **Step 6: Run the full suite**

Run: `npx vitest run`
Expected: PASS. `LivePreview.test.tsx` and `Customizer.test.tsx` both exercise this path; if either fails, the assertion is pinned to the old (wrong) `tee/olive` back shape and should be updated to the measured number.

- [ ] **Step 7: Commit**

```bash
git add src/lib/garments.ts src/lib/garments.test.ts src/components/products/LivePreview.tsx
git commit -m "fix: the shoot varies by view, so the shape map has to as well"
```

---

## Task 2: The catalogue manifest

**Files:**
- Create: `src/lib/garment-shots.ts`
- Create: `src/lib/garment-shots.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/garment-shots.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { PRODUCTS } from "@/lib/products";
import { catalogueShots, heroColour } from "./garment-shots";

const PUBLIC = join(process.cwd(), "public");

describe("catalogue shots", () => {
  it("leads with the back, because the plate is the product", () => {
    for (const product of PRODUCTS) {
      if (product.slug === "tote") continue;
      expect(catalogueShots(product.slug)[0]!.view, product.slug).toBe("back");
    }
  });

  it("offers the hoodie four aspects and the tee and crewneck three", () => {
    expect(catalogueShots("hoodie").map((shot) => shot.view)).toEqual([
      "back",
      "front",
      "profile",
      "fleece",
    ]);
    expect(catalogueShots("tee").map((shot) => shot.view)).toEqual([
      "back",
      "front",
      "profile",
    ]);
    expect(catalogueShots("crewneck").map((shot) => shot.view)).toEqual([
      "back",
      "front",
      "profile",
    ]);
  });

  it("offers the tote nothing, so its card keeps the placeholder", () => {
    // Deferred by docs/spec-print-layout.md. No shoot, no plate, no card image.
    expect(catalogueShots("tote")).toEqual([]);
  });

  it("points every shot at a file that really exists", () => {
    // The manifest lists only views that exist, never an aspiration, which is
    // what lets this be an unconditional assertion. `worn` is in the view
    // vocabulary and in no product's manifest: there is no on-model
    // photography yet. Adding the files and the manifest line is the whole of
    // the work to light it up.
    for (const product of PRODUCTS) {
      for (const shot of catalogueShots(product.slug)) {
        expect(existsSync(join(PUBLIC, shot.url)), shot.url).toBe(true);
      }
    }
  });

  it("prints only on the two sides a plate can go on", () => {
    // A plate floated over a three-quarter garment sits on air, and you cannot
    // see a chest print from the side.
    for (const product of PRODUCTS) {
      for (const shot of catalogueShots(product.slug)) {
        const printable = shot.view === "front" || shot.view === "back";
        expect(shot.printed, `${product.slug}/${shot.view}`).toBe(printable);
      }
    }
  });

  it("gives a printed shot a plate to overlay and an unprinted shot none", () => {
    for (const product of PRODUCTS) {
      for (const shot of catalogueShots(product.slug)) {
        if (shot.printed) expect(shot.plateUrl).toMatch(/^\/demo\/plate-/);
        else expect(shot.plateUrl).toBeNull();
      }
    }
  });

  it("writes alt text a person would recognise, never a filename", () => {
    const shots = catalogueShots("hoodie");
    expect(shots[0]!.alt).toBe(
      "The Kindred hoodie in Blue from the back, printed with a companion profile plate",
    );
    expect(shots[3]!.alt).toBe(
      "The brushed fleece inside of the Kindred hoodie in Blue",
    );
    for (const shot of shots) expect(shot.alt).not.toMatch(/\.webp|\//);
  });

  it("leads each card on a portrait colourway so the grid does not fight itself", () => {
    // The tee's Heritage Blue and Olive shots are LANDSCAPE. Leading with one
    // drops a wide garment into a grid of tall ones.
    expect(heroColour("hoodie")).toBe("Blue");
    expect(heroColour("crewneck")).toBe("Peach");
    expect(heroColour("tee")).toBe("White");
    for (const product of PRODUCTS) {
      if (product.slug === "tote") continue;
      const hero = heroColour(product.slug);
      expect(
        product.variants.some((variant) => variant.color === hero),
        `${product.slug} hero ${hero} is not a real colourway`,
      ).toBe(true);
      for (const shot of catalogueShots(product.slug)) {
        expect(shot.aspect, `${product.slug}/${shot.view}`).toBeGreaterThan(0);
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/garment-shots.test.ts`
Expected: FAIL — `Cannot find module './garment-shots'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/garment-shots.ts`:

```ts
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
 */
const VIEWS: Record<ProductSlug, GarmentView[]> = {
  hoodie: ["back", "front", "profile", "fleece"],
  crewneck: ["back", "front", "profile"],
  tee: ["back", "front", "profile"],
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/garment-shots.test.ts`
Expected: FAIL on `"points every shot at a file that really exists"` only if a `.webp` is missing — it should PASS all 8. The `plateUrl` test asserts the shape of the string, not the file, so it passes before Task 3 writes the PNGs.

- [ ] **Step 5: Commit**

```bash
git add src/lib/garment-shots.ts src/lib/garment-shots.test.ts
git commit -m "feat: which pictures a card shows, and in what order"
```

---

## Task 3: The demo plate

The card needs a plate to overlay. It is rendered once at build time by the production renderers — not per request, which would put `sharp` on the home page's critical path for an image that never changes, and not by a copy of the layout code, which could drift from what we print.

**Files:**
- Create: `scripts/alias-loader.mjs`
- Create: `scripts/build-catalogue-plate.ts`
- Create (generated, committed): `public/demo/plate-back-hoodie.png`, `plate-back-tee.png`, `plate-back-crewneck.png`, `plate-front.png`

No `package.json` change. This repo's scripts are run as `node scripts/<name>.ts` — Node 24 strips the types, and both `hash-admin-password.ts` and `simulate-itn.ts` say in their headers that there is deliberately no build step and no extra dependency. Keep it that way.

- [ ] **Step 1: The resolve hook, because type-stripping resolves neither aliases nor bare specifiers**

`simulate-itn.ts` gets away with `import { ... } from "../src/lib/payfast.ts"` because `payfast.ts` imports nothing from `src`. The plate does not have that luxury: `plate.ts` imports `@/lib/breeds` and `./text-to-path`, and Node's type-stripping resolves neither an alias nor an extensionless specifier. Rewriting those imports would mean touching the print path — the one part of this codebase where a mistake is a misprinted garment — so the script adapts to the code instead.

Create `scripts/alias-loader.mjs`:

```js
/**
 * Lets a plain `node scripts/*.ts` import modules out of src/.
 *
 * TWO THINGS NODE'S TYPE STRIPPING WILL NOT DO, both of which src/ relies on
 * because Next and Vitest both do them: resolve the "@/" alias from
 * tsconfig.json, and resolve a specifier with no file extension. Without this
 * hook, importing lib/print/plate.ts from a script dies on its first line.
 *
 * No dependency, which is the point. See the headers of the other scripts.
 *
 * USAGE
 *
 *   node --import ./scripts/alias-loader.mjs scripts/build-catalogue-plate.ts
 */
import { existsSync } from "node:fs";
import { register } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve as resolvePath } from "node:path";

const SRC = fileURLToPath(new URL("../src/", import.meta.url));

/** ts before tsx before a directory index, matching how bundlers guess. */
function firstThatExists(base) {
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
  ]) {
    if (existsSync(candidate) && !candidate.endsWith("/")) return candidate;
  }
  return null;
}

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    const found = firstThatExists(join(SRC, specifier.slice(2)));
    if (found) return next(pathToFileURL(found).href, context);
  }
  // A relative specifier with no extension, e.g. "./text-to-path".
  if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) {
    const from = context.parentURL ? dirname(fileURLToPath(context.parentURL)) : SRC;
    const found = firstThatExists(resolvePath(from, specifier));
    if (found) return next(pathToFileURL(found).href, context);
  }
  return next(specifier, context);
}

// Registering from inside the same file it hooks means one --import flag and
// one file, rather than a loader plus a registrar.
if (!process.env.ALIAS_LOADER_REGISTERED) {
  process.env.ALIAS_LOADER_REGISTERED = "1";
  register(import.meta.url, import.meta.url);
}
```

- [ ] **Step 2: Verify the hook resolves the print path before writing anything that depends on it**

Run:
```bash
node --import ./scripts/alias-loader.mjs --eval 'import("./src/lib/print/plate.ts").then((m) => console.log(Object.keys(m).join(", ")))'
```
Expected: a list including `backPlate, frontPlate, composePlate`. If it throws `ERR_MODULE_NOT_FOUND` naming `@/lib/breeds`, the hook is not registering — check that `register` ran before the dynamic import, and if `--import` with self-registration proves awkward on this Node version, split the file into `alias-loader.mjs` (exporting `resolve` only) plus a three-line `scripts/register-alias.mjs` that calls `register("./alias-loader.mjs", import.meta.url)`.

- [ ] **Step 3: Write the script**

Create `scripts/build-catalogue-plate.ts`:

```ts
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
```

- [ ] **Step 4: Run it**

```bash
node --import ./scripts/alias-loader.mjs scripts/build-catalogue-plate.ts
```

Expected: four paths printed with their dimensions —
`plate-back-hoodie.png 900x1125`, `plate-back-tee.png 900x1080`,
`plate-back-crewneck.png 900x1125`, `plate-front.png 600x818`.

If `assets/demo-companion.png` is absent, also the warning. That is expected until the owner supplies the illustration, and the plates are still written.

- [ ] **Step 5: Look at what it made**

Run: `npx vitest run` first (nothing should break), then open `public/demo/plate-back-hoodie.png` and confirm by eye: KINDRED CREATURES across the top, GERMAN SHEPHERD beneath it, the binomial in italic, the portrait area, Loyal · Watchful · Sleepy, then ORIGIN / GROUP / TOGETHER SINCE, then REX. Transparent background throughout — if it has a white box behind it, `composePlate` was passed an opaque background and the card will print a rectangle of ink.

- [ ] **Step 6: Commit**

```bash
git add scripts/alias-loader.mjs scripts/build-catalogue-plate.ts public/demo
git commit -m "feat: the demo plate, rendered by the renderers that print"
```

> **Note for when the `worn` shots arrive.** `scripts/import-garments.mjs` is the existing pipeline from `Stock Images/` into `public/garments/`, and it has its own `VIEWS` set on line 45: `front`, `back`, `profile`, `fleece`. It skips anything else with a warning. Adding on-model photography means adding `"worn"` to that set as well as to the manifest in `garment-shots.ts` and to `PHOTO_SHAPE`. Three places, and the test in Task 2 catches two of them.

---

## Task 4: `<GarmentShots>`

**Files:**
- Create: `src/components/products/GarmentShots.tsx`
- Create: `src/components/products/GarmentShots.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/products/GarmentShots.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { catalogueShots } from "@/lib/garment-shots";
import { GarmentShots } from "./GarmentShots";

describe("GarmentShots", () => {
  it("opens on the back, because the plate is the product", () => {
    render(<GarmentShots shots={catalogueShots("hoodie")} slug="hoodie" />);
    expect(
      screen.getByAltText(/from the back, printed with a companion profile/i),
    ).toBeInTheDocument();
  });

  it("gives one dot per aspect, naming each one", () => {
    render(<GarmentShots shots={catalogueShots("hoodie")} slug="hoodie" />);
    const dots = screen.getAllByRole("button");
    expect(dots).toHaveLength(4);
    expect(dots.map((dot) => dot.getAttribute("aria-label"))).toEqual([
      "Back",
      "Chest print",
      "Side",
      "Fleece",
    ]);
  });

  it("changes the picture and its alt text when a dot is pressed", async () => {
    const user = userEvent.setup();
    render(<GarmentShots shots={catalogueShots("hoodie")} slug="hoodie" />);

    await user.click(screen.getByRole("button", { name: "Fleece" }));

    expect(screen.getByAltText(/brushed fleece inside/i)).toBeInTheDocument();
    expect(
      screen.queryByAltText(/from the back, printed with/i),
    ).not.toBeInTheDocument();
  });

  it("marks the showing aspect as the pressed one, for a screen reader", async () => {
    const user = userEvent.setup();
    render(<GarmentShots shots={catalogueShots("hoodie")} slug="hoodie" />);

    expect(screen.getByRole("button", { name: "Back" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "Side" }));
    expect(screen.getByRole("button", { name: "Side" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Back" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("advances to the next aspect on hover, for a mouse", async () => {
    const user = userEvent.setup();
    render(<GarmentShots shots={catalogueShots("hoodie")} slug="hoodie" />);

    await user.hover(screen.getByTestId("garment-shots"));
    expect(screen.getByAltText(/chest print on the Kindred hoodie/i)).toBeInTheDocument();

    await user.unhover(screen.getByTestId("garment-shots"));
    expect(
      screen.getByAltText(/from the back, printed with/i),
    ).toBeInTheDocument();
  });

  it("overlays the demo plate on a printed aspect and not on a bare one", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <GarmentShots shots={catalogueShots("hoodie")} slug="hoodie" />,
    );
    expect(
      container.querySelector('img[src*="plate-back-hoodie"]'),
    ).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Side" }));
    expect(container.querySelector('img[src*="plate-"]')).toBeNull();
  });

  it("renders no dot row when there is only one aspect", () => {
    render(<GarmentShots shots={catalogueShots("hoodie").slice(0, 1)} slug="hoodie" />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("renders nothing at all when there are no shots", () => {
    // The tote. The caller falls back to a PhotoFrame; this must not render an
    // empty bordered box next to it.
    const { container } = render(<GarmentShots shots={[]} slug="tote" />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/products/GarmentShots.test.tsx`
Expected: FAIL — `Cannot find module './GarmentShots'`.

- [ ] **Step 3: Write the implementation**

Create `src/components/products/GarmentShots.tsx`:

```tsx
"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { PLACEMENT, type GarmentSide } from "@/lib/garments";
import { viewLabel, type Shot } from "@/lib/garment-shots";
import type { ProductSlug } from "@/lib/products";

/**
 * A card's image area: the garment, the print on it, and the other aspects of
 * it a click away.
 *
 * TWO THINGS THIS DOES THAT ARE NOT DECORATION.
 *
 * The parchment lift. The shoot is blank garments on white, which is right for
 * the customizer and wrong for a card on a parchment page. Backgrounds measure
 * 253 to 255 across every file with no vignette, so `mix-blend-mode: multiply`
 * over a parchment fill drops the background to exactly the surface colour and
 * leaves the garment. No second copy of 34 files, and it works on colourways
 * that arrive later. It costs about 5% darkening on the garment, which reads as
 * fabric on a warm surface; white garments take the tint and read as cream.
 *
 * The nested boxes. The OUTER box is whatever shape the grid asked for. The
 * INNER box is the PHOTOGRAPH'S own shape. This is the one thing here not to
 * simplify: plate placement is a percentage of the photograph, so a box of any
 * other shape letterboxes the picture while the plate keeps measuring against
 * the box, and the portrait ends up on the parchment beside the garment.
 * GarmentView in LivePreview.tsx carries the same structure for the same
 * reason.
 */
export function GarmentShots({
  shots,
  slug,
  aspect = "4 / 5",
  className,
  preload = false,
  sizes = "(min-width: 768px) 45vw, 100vw",
}: {
  shots: Shot[];
  /** Whose placement to use. Required: a printed shot cannot be placed without it. */
  slug: ProductSlug;
  /** CSS aspect-ratio for the outer box, set by the grid. */
  aspect?: string;
  className?: string;
  preload?: boolean;
  sizes?: string;
}) {
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);

  // The tote. Rendering an empty bordered box beside a real card is worse than
  // rendering nothing and letting the caller fall back to its placeholder.
  if (shots.length === 0) return null;

  // HOVER ADVANCES BY ONE, it does not cycle. A card that walks through four
  // pictures while the cursor rests on it is a card nobody can read. One nudge
  // to show there is more here; the dots are how you get to the rest.
  const showing =
    hovered && shots.length > 1 ? (index + 1) % shots.length : index;
  const shot = shots[showing]!;
  // `printed` is true only for "front" and "back", which are exactly the two
  // keys PLACEMENT has, so the cast is the type system catching up with the
  // manifest rather than a hole in it.
  const placement = shot.printed
    ? PLACEMENT[slug][shot.view as GarmentSide]
    : null;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div
        data-testid="garment-shots"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="relative flex w-full items-center justify-center overflow-hidden bg-surface"
        style={{ aspectRatio: aspect }}
      >
        {/*
          The photograph's own shape, centred in whatever box the grid gave us.
          isolate creates a stacking context so the multiply below blends
          against this box's parchment and not against whatever the page has
          behind the card.
        */}
        <div
          className="relative isolate h-full max-h-full max-w-full bg-surface"
          style={{ aspectRatio: shot.aspect }}
        >
          <Image
            key={shot.url}
            src={shot.url}
            alt={shot.alt}
            fill
            sizes={sizes}
            preload={preload}
            // multiply drops the white studio background to the parchment
            // beneath it. See the note at the top of this file.
            className="object-cover mix-blend-multiply"
          />

          {placement && shot.plateUrl ? (
            <div
              className="absolute"
              style={{
                top: `${placement.top}%`,
                left: `${placement.left}%`,
                width: `${placement.width}%`,
              }}
            >
              {/* The plate is a transparent PNG, so the garment colour shows
                  through it exactly as ink does on fabric. */}
              <Image
                src={shot.plateUrl}
                alt=""
                width={900}
                height={1125}
                sizes="30vw"
                className="h-auto w-full"
              />
            </div>
          ) : null}
        </div>
      </div>

      {shots.length > 1 ? (
        <div
          className="flex items-center justify-center gap-2"
          role="group"
          aria-label="Which aspect to show"
        >
          {shots.map((option, optionIndex) => (
            <button
              key={option.view}
              type="button"
              aria-label={viewLabel(option.view)}
              aria-pressed={showing === optionIndex}
              onClick={() => {
                setIndex(optionIndex);
                // Otherwise the hover offset immediately advances past the dot
                // the visitor just pressed, and the picture they asked for is
                // the one they cannot get to with a mouse.
                setHovered(false);
              }}
              className={cn(
                "h-1.5 rounded-full transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                "focus-visible:ring-offset-2 focus-visible:ring-offset-base",
                showing === optionIndex
                  ? "w-5 bg-accent-secondary"
                  : "w-1.5 bg-line-strong hover:bg-accent-secondary/60",
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/products/GarmentShots.test.tsx`
Expected: PASS, 8 tests.

If the hover test fails because `userEvent.hover` does not fire React's `onMouseEnter` in this jsdom version, use `fireEvent.mouseEnter`/`mouseLeave` from `@testing-library/react` instead — do not change the component to satisfy the test.

- [ ] **Step 5: Check the class names exist**

Run: `grep -n "line-strong\|accent-secondary" src/app/globals.css`
Expected: both present. `ProductRange.tsx:61` already uses `hover:border-line-strong` and `CatalogueCard.tsx:57` uses `text-accent-secondary`, so they should be. If either is absent, use the token that is.

- [ ] **Step 6: Commit**

```bash
git add src/components/products/GarmentShots.tsx src/components/products/GarmentShots.test.tsx
git commit -m "feat: the garment, the print on it, and its other aspects"
```

---

## Task 5: The shop card

**Files:**
- Modify: `src/components/shop/CatalogueCard.tsx:1-49`
- Modify: `src/app/shop/page.tsx:70-89`
- Modify: `src/app/shop/page.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/app/shop/page.test.tsx`, inside `describe("shop page catalogue")`:

```tsx
  it("shows real photography for the three shot garments, several aspects each", () => {
    render(<ShopPage />);
    // The hoodie leads on its Blue back, which is the plate: the product.
    expect(
      screen.getByAltText(
        "The Kindred hoodie in Blue from the back, printed with a companion profile plate",
      ),
    ).toBeInTheDocument();

    // Four aspects for the hoodie, three each for the tee and crewneck.
    expect(
      screen.getAllByRole("group", { name: "Which aspect to show" }),
    ).toHaveLength(3);
  });

  it("keeps the hatched placeholder for the tote, which has no shoot", () => {
    render(<ShopPage />);
    // Deferred by docs/spec-print-layout.md. A photograph would be a lie.
    expect(screen.getByText(/flatlay: the natural canvas kindred tote/i)).toBeInTheDocument();
  });

  it("names the demo companion as a stand-in, once, beneath the grid", () => {
    render(<ShopPage />);
    // Every card shows the same example dog. Saying so four times is noise;
    // not saying it is a claim about an animal that is not the customer's.
    const disclosures = screen.getAllByText(
      /The illustration shown is a German Shepherd example/i,
    );
    expect(disclosures).toHaveLength(1);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/shop/page.test.tsx`
Expected: FAIL — no alt text, no group role, no disclosure. The two pre-existing tests in that file still pass.

- [ ] **Step 3: Change the card**

In `src/components/shop/CatalogueCard.tsx`, delete the `catalogueShot` map (lines 11-19) and the `PhotoFrame` import's exclusive use. Replace the imports and the `<Link>` block:

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { PhotoFrame } from "@/components/ui/PhotoFrame";
import { GarmentShots } from "@/components/products/GarmentShots";
import { catalogueShots } from "@/lib/garment-shots";
import {
  FIT_LABELS,
  formatZar,
  fromPriceZar,
  type Product,
} from "@/lib/products";
```

Inside the component, above the `return`:

```tsx
  // Empty for the tote, which is deferred and has no shoot. It keeps the
  // hatched frame rather than borrowing a photograph of something else.
  const shots = catalogueShots(product.slug);
```

Now replace the image block (currently lines 43-49, the `<Link>` wrapping a `PhotoFrame`).

**The photo can no longer live inside that `<Link>`.** `GarmentShots` renders the dots as `<button>`s, and a button inside an anchor is invalid HTML that also breaks both controls: the anchor swallows the click, so the dots do nothing. The tote's placeholder has no buttons and can keep its link.

```tsx
      {shots.length > 0 ? (
        <GarmentShots
          shots={shots}
          slug={product.slug}
          aspect="4 / 5"
          className="p-4 pb-5"
          sizes="(min-width: 768px) 45vw, 100vw"
        />
      ) : (
        <Link href={href} className="block">
          <PhotoFrame
            aspect="5 / 4"
            description="flatlay: the natural canvas kindred tote squared to camera, a pet portrait print centred, soft daylight, warm parchment backdrop"
            className="rounded-none border-0"
          />
        </Link>
      )}
```

and make the heading a link so the card still has a path to the product besides the Personalise button:

```tsx
          <h2 className="font-display text-2xl leading-[1.15] text-ink">
            <Link href={href} className="hover:text-accent-secondary">
              {product.name}
            </Link>
          </h2>
```

The existing `screen.getByRole("heading", { level: 2, name: product.name })` assertion still passes — an anchor inside a heading keeps the accessible name.

- [ ] **Step 4: Add the disclosure to the shop page**

In `src/app/shop/page.tsx`, add the import:

```tsx
import { stockDisclosure } from "@/lib/companion";
```

and beneath the closing `</div>` of the product grid, still inside `<Container>`:

```tsx
          {/*
            Every card shows the same demo companion. stockDisclosure exists
            because a stand-in illustration has to be named as one, and a
            catalogue card's dog is a stand-in by definition. Once, beneath the
            grid: four repetitions of the same sentence is noise, and none is a
            claim about an animal that is not the customer's.
          */}
          <p className="mt-10 max-w-prose text-sm leading-relaxed text-muted">
            {stockDisclosure("German Shepherd")}
          </p>
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/app/shop/page.test.tsx`
Expected: PASS, 9 tests.

- [ ] **Step 6: Commit**

```bash
git add src/components/shop/CatalogueCard.tsx src/app/shop/page.tsx src/app/shop/page.test.tsx
git commit -m "feat: the shop shows the garment, and more than one side of it"
```

---

## Task 6: The home tiles

The bento is compact and its cells are landscape (`3 / 2` for the lead pair, `4 / 3` for the rest), while the photographs are portrait. Keep the cells as they are and let the garment letterbox onto parchment inside them — cropping a garment to fill a landscape cell cuts the hem off, and `object-cover` on a box that is not the photograph's shape moves the plate off the print area.

**Files:**
- Modify: `src/components/sections/ProductRange.tsx:21-29,63-67`

- [ ] **Step 1: Change the tile**

Delete the `tileShot` map (lines 21-29). Add the imports:

```tsx
import { GarmentShots } from "@/components/products/GarmentShots";
import { catalogueShots } from "@/lib/garment-shots";
```

Inside the `PRODUCTS.map` callback, above the `return`:

```tsx
            const shots = catalogueShots(product.slug);
```

Now replace the whole tile body — lines 59-77, the `<Link>` wrapping a `PhotoFrame` and the caption.

**The tile can no longer be one big `<Link>`.** It currently wraps everything, and nesting the dot `<button>`s inside an anchor is invalid HTML that also breaks both controls — the anchor eats the clicks. The link shrinks to cover the caption, which keeps a path to the product page from every tile:

```tsx
                <div className="group flex h-full flex-col overflow-hidden rounded-lg border border-line bg-surface transition-colors hover:border-line-strong">
                  {shots.length > 0 ? (
                    <GarmentShots
                      shots={shots}
                      slug={product.slug}
                      aspect={lead ? "3 / 2" : "4 / 3"}
                      className="p-3"
                      sizes={
                        lead
                          ? "(min-width: 768px) 50vw, 100vw"
                          : "(min-width: 768px) 25vw, 100vw"
                      }
                      preload={product.slug === "hoodie"}
                    />
                  ) : (
                    <PhotoFrame
                      aspect="4 / 3"
                      description="flatlay: the natural canvas kindred tote with a pet portrait print, propped upright, soft daylight"
                      className="rounded-none border-0"
                    />
                  )}
                  <Link
                    href={href}
                    className="flex flex-col gap-1 border-t border-line p-4"
                  >
                    <p className="font-display text-lg leading-[1.2] text-ink">
                      {product.name}
                    </p>
                    <p className="text-sm text-muted">
                      from{" "}
                      <span className="text-accent-secondary">{price}</span>
                    </p>
                  </Link>
                </div>
```

`preload` on the hoodie only: it is the lead tile and the largest image above the fold, and marking all four defeats the purpose.

- [ ] **Step 2: Check whether a test asserted the old whole-tile link**

Run: `grep -rn "ProductRange\|range" src/app/page.test.tsx src/components/sections/*.test.tsx 2>/dev/null`

If a test asserts four links to the product pages from the home page, it still passes — the caption is a link. If one asserts the link's accessible name includes the photo's alt text, update it to the caption text.

- [ ] **Step 3: Run the suite**

Run: `npx vitest run`
Expected: PASS. Any failure naming a `tileShot` caption string is a test asserting the placeholder that no longer exists; update it to assert the alt text instead.

- [ ] **Step 4: Commit**

```bash
git add src/components/sections/ProductRange.tsx
git commit -m "feat: the home page shows the range, photographed"
```

---

## Task 7: Look at it

The suite cannot tell you whether a plate landed on a pocket seam. Placement is calibrated by eye, and this is the step where that happens.

- [ ] **Step 1: Start the dev server**

Use `preview_start` with `{name: "dev"}` (create `.claude/launch.json` with `npm run dev` on port 3000 if it is absent). Do not run the server with Bash.

- [ ] **Step 2: Check the console and the network**

`read_console_messages` and `read_network_requests` for `/` and `/shop`.
Expected: no errors, and every `/garments/**` and `/demo/**` request returning 200. A 404 on a plate means Task 3 did not write it; a 404 on a `.webp` means the manifest in `garment-shots.ts` and `PHOTO_SHAPE` disagree.

- [ ] **Step 3: Screenshot both pages, and judge four things**

`computer {action: "screenshot"}` on `/` and `/shop`, then `resize_window` to `mobile` and again.

1. **The parchment lift.** Is the background gone, or is there a white box around each garment? A visible white box means the `isolate` stacking context is blending against the wrong parent.
2. **Plate placement.** On the hoodie's back: below the hood, centred between the shoulders, clear of the hem. On the front: left chest from the wearer's view, so right of centre on screen, above the pocket seam.
3. **The white garments.** The tee leads on White and the multiply tints it toward cream. Judge whether that is acceptable; it is the spec's one open aesthetic risk.
4. **The letterboxing.** Portrait garments in the home page's landscape cells will have parchment either side. Does it read as a catalogue plate or as a mistake?

- [ ] **Step 4: Hover and press**

`computer` hover over a card, screenshot, confirm the picture advanced by one. Click the third dot, screenshot, confirm the picture changed and the dot widened.

- [ ] **Step 5: Fix by eye if needed**

Placement lives in `PLACEMENT` in `src/lib/garments.ts` and is shared with the customizer, so a change here changes the preview too — which is correct, and is why `/dev/mockups` exists to check every product, colour and side at once. Adjust there, not with a catalogue-only offset.

- [ ] **Step 6: Commit any calibration**

```bash
git add -A
git commit -m "fix: the plate sits where it sits on the garment"
```

---

## Task 8: The last mile

- [ ] **Step 1: Full suite and lint**

Run: `npx vitest run && npx eslint`
Expected: both clean.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: clean. `GarmentShots` is a client component inside server components, which is fine; a "useState in a Server Component" error means the `"use client"` directive is missing.

- [ ] **Step 3: Check the portrait situation before declaring done**

Run: `ls -la assets/demo-companion.png`

If it is absent, the plates on every card have a hole where the animal belongs. **Say so plainly in the completion report and do not describe the work as finished** — a finished-looking plate with no dog is worse than the placeholder it replaced. The remaining step is one file from the owner plus `npm run build:catalogue-plate` and a commit of `public/demo/`.

- [ ] **Step 4: Update the spec's status**

Append to `docs/superpowers/specs/2026-08-17-catalogue-photography-design.md`:

```markdown
---

## Status, 17 August 2026

Built. Home page and `/shop` show real photography, several aspects per card,
plate composited by shared placement. Outstanding: the demo portrait
(`assets/demo-companion.png`), and on-model and folded photography for the
`worn` slot.
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs: where the catalogue photography got to"
```
