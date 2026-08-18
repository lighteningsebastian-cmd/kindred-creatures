# Print Zoom and Colourway Tiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the print legible — a lightbox on `/shop` that frames the print rather than the garment, and home tiles that cycle colourways in square boxes instead of offering a 19px chest badge.

**Architecture:** All zoom arithmetic goes in one pure module (`src/lib/print-zoom.ts`) so it can be tested without rendering. The shot manifest gains two functions with one axis each — `catalogueShots(slug, colour)` varies view for the shop, `colourwayShots(slug)` varies colour for the home page — and each `Shot` carries everything the renderer needs, so `GarmentShots` never learns which page it is on.

**Tech Stack:** Next 16 (App Router), React 19, Tailwind 4, Vitest + Testing Library, `motion` for reduced-motion detection, `sharp` in tests for measuring real files.

**Spec:** `docs/superpowers/specs/2026-08-18-print-zoom-and-colourways-design.md`

---

## Read first

`AGENTS.md`: this Next.js has breaking changes from training data. Two that bite here, both already confirmed against `node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md`:

- **`priority` is deprecated in favour of `preload`** (Next 16). `GarmentShots` already uses `preload`. `LivePreview.tsx` still passes `priority` — that is pre-existing debt, do not copy it and do not fix it here.
- **`sizes` decides which srcset candidate the browser picks.** In the lightbox the photograph is drawn at up to 3× the box width, so `sizes` must describe the *scaled* width or the browser fetches a small candidate and the fabric is softer than the arithmetic promises.

## File structure

| File | Responsibility |
|---|---|
| `src/lib/garments.ts` (modify) | `PHOTO_SHAPE` → `PHOTO_SIZE` holding `{w,h}`; add `photoSourceWidth()` |
| `src/lib/print-zoom.ts` (create) | Pure geometry: where the plate's centre is, how far to zoom, the upscale ceiling |
| `src/lib/garment-shots.ts` (modify) | `Shot` gains `plateAspect`, `label`, `swatchHex`, `sourceWidth`; add `colourwayShots()` |
| `src/components/products/PrintLightbox.tsx` (create) | The modal: framing, focus, escape, scroll lock |
| `src/components/products/GarmentShots.tsx` (modify) | Renders swatch or dot from the shot; optional zoom trigger |
| `src/components/sections/ProductRange.tsx` (modify) | Four equal square tiles, colourway shots |
| `src/components/shop/CatalogueCard.tsx` (modify) | Passes `zoomable` |

---

### Task 1: `PHOTO_SIZE` — keep the pixels, not just the ratio

The upscale ceiling needs each photograph's real width in pixels. `PHOTO_SHAPE` stores only `w/h`, throwing that away. Storing `{w,h}` gives both from one table instead of two tables holding the same measurements twice.

**Files:**
- Modify: `src/lib/garments.ts` (`PHOTO_SHAPE` at :81, `photoAspect` at :126, `garmentViewUrl` at :237)
- Test: `src/lib/garments.test.ts`

- [ ] **Step 1: Write the failing test**

Append inside the `describe("garment photography", ...)` block in `src/lib/garments.test.ts`:

```ts
  it("reports each photograph's real pixel width, because the zoom ceiling needs it", async () => {
    // Not the aspect ratio. The upscale cap in print-zoom.ts asks "how many
    // pixels does this file actually have", and a ratio cannot answer that.
    // Sources are NOT uniform: crewneck Grey is 1211 and the tee's Heritage
    // Blue is 1400, so a single assumed number would license a 25% overzoom
    // on some colourways and underuse others.
    let checked = 0;
    for (const product of PRODUCTS) {
      for (const variant of product.variants) {
        for (const view of GARMENT_VIEWS) {
          const url = garmentViewUrl(product.slug, variant.color, view);
          if (!url) continue;
          checked += 1;
          const meta = await sharp(join(PUBLIC, url)).metadata();
          expect(
            photoSourceWidth(product.slug, variant.color, view),
            `${product.slug}/${variant.color}/${view}`,
          ).toBe(meta.width);
        }
      }
    }
    expect(checked, "photographs actually checked, of 33 on disk").toBe(33);
  });
```

Add `photoSourceWidth` to the import block at the top of the file.

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run src/lib/garments.test.ts
```

Expected: FAIL — `photoSourceWidth is not a function`.

- [ ] **Step 3: Convert the table mechanically**

Do not hand-transcribe 33 entries. Run this once; it rewrites the literal in place from the ratios already in the file:

```bash
node -e '
const fs=require("fs");
const p="src/lib/garments.ts";
let s=fs.readFileSync(p,"utf8");
s=s.replace(/const PHOTO_SHAPE: Record<string, number> = \{[\s\S]*?\n\};/, (block)=>{
  const rows=[...block.matchAll(/"([^"]+)":\s*(\d+)\s*\/\s*(\d+),/g)]
    .map(m=>`  "${m[1]}": { w: ${m[2]}, h: ${m[3]} },`).join("\n");
  return "const PHOTO_SIZE: Record<string, { w: number; h: number }> = {\n"+rows+"\n};";
});
fs.writeFileSync(p,s);
console.log("rewrote", (s.match(/w: \d+, h: \d+/g)||[]).length, "entries");
'
```

Expected output: `rewrote 33 entries`.

- [ ] **Step 4: Point the three readers at the new table**

In `src/lib/garments.ts`, replace the body of `photoAspect` and the guard in `garmentViewUrl`, and add the new function:

```ts
export function photoAspect(
  slug: ProductSlug,
  color: string,
  view: GarmentView = "front",
): number {
  const photo = garmentPhoto(slug, color);
  if (!photo) return DEFAULT_SHAPE;
  const size = PHOTO_SIZE[`${slug}/${photo.dir}/${view}`];
  return size ? size.w / size.h : DEFAULT_SHAPE;
}

/**
 * The photograph's real width in pixels.
 *
 * The zoom ceiling in lib/print-zoom.ts is the only caller and it needs pixels,
 * not a ratio: "may this be drawn at 3400px" is a question about how many
 * pixels the file has. Returns null when there is no such photograph, which is
 * the tote and any colourway shot that has not happened yet.
 */
export function photoSourceWidth(
  slug: ProductSlug,
  color: string,
  view: GarmentView,
): number | null {
  const photo = garmentPhoto(slug, color);
  if (!photo) return null;
  return PHOTO_SIZE[`${slug}/${photo.dir}/${view}`]?.w ?? null;
}
```

In `garmentViewUrl`, change the existence check:

```ts
  if (!(`${slug}/${photo.dir}/${view}` in PHOTO_SIZE)) return null;
```

Update the doc comment above the table: it currently says "The shape of each photograph, width over height" — it now stores the measurements themselves, so say so, and keep the paragraph explaining why this is per view as well as per colourway.

- [ ] **Step 5: Run the whole garments suite**

```bash
npx vitest run src/lib/garments.test.ts
```

Expected: PASS, including the pre-existing `photoAspect`-vs-sharp test at :97 and the tee/olive regression guard at :112. Those two are what prove the conversion did not corrupt a number.

- [ ] **Step 6: Commit**

```bash
git add src/lib/garments.ts src/lib/garments.test.ts
git commit -m "refactor: the photo table keeps its pixels, because a ratio cannot cap a zoom"
```

---

### Task 2: `print-zoom.ts` — the arithmetic, with nothing rendered

**Files:**
- Create: `src/lib/print-zoom.ts`
- Test: `src/lib/print-zoom.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/print-zoom.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { PLACEMENT } from "@/lib/garments";
import {
  MAX_UPSCALE,
  TARGET_PRINT_FRACTION,
  plateCentre,
  zoomScale,
} from "./print-zoom";

const FRONT_PLATE = 600 / 818;
const BACK_PLATE_HOODIE = 900 / 1125;
const BACK_PLATE_TEE = 900 / 1080;
const PHOTO = 0.8;

describe("plateCentre", () => {
  it("finds the middle of the hoodie's chest badge", () => {
    const centre = plateCentre(PLACEMENT.hoodie.front, PHOTO, FRONT_PLATE);
    expect(centre.x).toBeCloseTo(62.5, 1);
    expect(centre.y).toBeCloseTo(37.1, 1);
  });

  it("does not hand the tee the hoodie's origin", () => {
    // The tee's back plate is 900x1080 and the hoodie's is 900x1125. Assuming
    // one number puts the tee's zoom origin off centre by about 4% of the
    // photograph, which is a visible mis-frame at 1.3x.
    const tee = plateCentre(PLACEMENT.tee.back, PHOTO, BACK_PLATE_TEE);
    const asIfHoodie = plateCentre(PLACEMENT.tee.back, PHOTO, BACK_PLATE_HOODIE);
    expect(tee.y).not.toBeCloseTo(asIfHoodie.y, 1);
  });

  it("puts a centred plate on the centreline", () => {
    expect(plateCentre(PLACEMENT.hoodie.back, PHOTO, BACK_PLATE_HOODIE).x)
      .toBeCloseTo(50, 5);
  });
});

describe("zoomScale", () => {
  const source = 1120;

  it("magnifies the chest badge far more than the back plate", () => {
    const front = zoomScale({ plateWidthPct: 13, boxWidth: 375, photoSourceWidth: source });
    const back = zoomScale({ plateWidthPct: 46, boxWidth: 375, photoSourceWidth: source });
    expect(front).toBeGreaterThan(back);
  });

  it("still magnifies the back plate, rather than opening at life size", () => {
    // 0.62 / 0.46 = 1.35. If this ever returns 1 the back view has become a
    // modal that does nothing, and it should be made un-clickable instead.
    expect(zoomScale({ plateWidthPct: 46, boxWidth: 375, photoSourceWidth: source }))
      .toBeCloseTo(TARGET_PRINT_FRACTION / 0.46, 2);
  });

  it("lets the ceiling bind on a wide screen and not on a phone", () => {
    const wide = zoomScale({ plateWidthPct: 13, boxWidth: 1200, photoSourceWidth: source });
    const phone = zoomScale({ plateWidthPct: 13, boxWidth: 375, photoSourceWidth: source });
    expect(wide).toBeCloseTo((MAX_UPSCALE * source) / 1200, 2);
    expect(phone).toBeCloseTo(TARGET_PRINT_FRACTION / 0.13, 2);
  });

  it("never enlarges the photograph past the cap, at any width", () => {
    for (let box = 320; box <= 2560; box += 40) {
      for (const pct of [13, 46]) {
        const scale = zoomScale({ plateWidthPct: pct, boxWidth: box, photoSourceWidth: source });
        expect((box * scale) / source, `box ${box}, plate ${pct}%`)
          .toBeLessThanOrEqual(MAX_UPSCALE + 0.001);
      }
    }
  });

  it("never zooms out", () => {
    // A huge box and a small source would otherwise return a scale below 1 and
    // shrink the garment inside its own lightbox.
    expect(zoomScale({ plateWidthPct: 46, boxWidth: 4000, photoSourceWidth: 400 }))
      .toBeGreaterThanOrEqual(1);
  });

  it("stays at life size when there is no plate to frame", () => {
    // Fleece and profile carry no print, so there is nothing to frame on.
    expect(zoomScale({ plateWidthPct: null, boxWidth: 900, photoSourceWidth: source })).toBe(1);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run src/lib/print-zoom.test.ts
```

Expected: FAIL — cannot resolve `./print-zoom`.

- [ ] **Step 3: Write the module**

Create `src/lib/print-zoom.ts`:

```ts
import type { PlatePlacement } from "@/lib/garments";

/**
 * Framing the print, not the garment.
 *
 * A lightbox showing a whole hoodie at 92% of screen height puts the chest
 * badge at about 105px — against the 67px it already is on a shop card. That
 * is a modal, a focus trap and an escape handler bought for 1.6x, still
 * unreadable. Everything here exists to frame the plate instead.
 *
 * See docs/superpowers/specs/2026-08-18-print-zoom-and-colourways-design.md.
 */

/** How much of the lightbox's width the print should try to fill. */
export const TARGET_PRINT_FRACTION = 0.62;

/**
 * How far the photograph may be drawn past its own pixels.
 *
 * The plate is a separate layer over the photograph and is redrawn crisp from
 * its own source, so only the fabric softens. Three times is where the fabric
 * stops reading as a photograph and starts reading as a blown-up image.
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
 * COMPUTED, NOT HARDCODED, because it differs per product and per side. The
 * plate is placed by width alone, so its height has to be recovered from the
 * two aspect ratios before its centre can be found: a plate that is 46% of the
 * width is not 46% of the height unless the plate and the photograph happen to
 * be the same shape, and they never are.
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
 * A FRACTION OF THE BOX, NOT A FIXED MULTIPLIER, and that is what lets one
 * number serve both sides and every screen. The chest badge is 13% of the
 * garment's width and the back plate is 46%, so the same target asks for 4.8x
 * of one and 1.35x of the other without a special case. It is also why there
 * is no mobile breakpoint: a phone's box is smaller, so the same fraction is
 * reached at the same scale and the ceiling simply stops binding.
 */
export function zoomScale({
  plateWidthPct,
  boxWidth,
  photoSourceWidth,
  target = TARGET_PRINT_FRACTION,
  maxUpscale = MAX_UPSCALE,
}: {
  /** The plate's width as a % of the photograph, or null for a view with no print. */
  plateWidthPct: number | null;
  /** The lightbox's own width in CSS pixels. */
  boxWidth: number;
  /** The photograph's width in real pixels. */
  photoSourceWidth: number;
  target?: number;
  maxUpscale?: number;
}): number {
  if (!plateWidthPct || boxWidth <= 0 || photoSourceWidth <= 0) return 1;
  const wanted = target / (plateWidthPct / 100);
  const ceiling = (maxUpscale * photoSourceWidth) / boxWidth;
  return Math.max(1, Math.min(wanted, ceiling));
}
```

- [ ] **Step 4: Run it and watch it pass**

```bash
npx vitest run src/lib/print-zoom.test.ts
```

Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/print-zoom.ts src/lib/print-zoom.test.ts
git commit -m "feat: how far to zoom so the print fills its share of the frame"
```

---

### Task 3: the manifest gains a colour axis

`catalogueShots` varies view within one colourway. `colourwayShots` varies colourway within one view. Each shot carries what the renderer needs so `GarmentShots` never learns which page it is on.

**Files:**
- Modify: `src/lib/garment-shots.ts`
- Test: `src/lib/garment-shots.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/garment-shots.test.ts`:

```ts
import { colourwayShots } from "./garment-shots";
import { PRODUCTS, getProduct } from "@/lib/products";

describe("colourwayShots", () => {
  it("offers one shot per colourway, and every one is the back", () => {
    // The home page varies colour; the shop varies view. A front shot here
    // would be the 19px badge this change exists to remove.
    for (const product of PRODUCTS) {
      if (product.slug === "tote") continue;
      const shots = colourwayShots(product.slug);
      expect(shots.length, product.slug).toBe(product.variants.length);
      expect(shots.every((shot) => shot.view === "back"), product.slug).toBe(true);
    }
  });

  it("counts three, four and three", () => {
    expect(colourwayShots("hoodie")).toHaveLength(3);
    expect(colourwayShots("crewneck")).toHaveLength(4);
    expect(colourwayShots("tee")).toHaveLength(3);
    expect(colourwayShots("tote")).toEqual([]);
  });

  it("starts on the hero colourway", () => {
    expect(colourwayShots("hoodie")[0]!.label).toBe("Blue");
    expect(colourwayShots("crewneck")[0]!.label).toBe("Peach");
    expect(colourwayShots("tee")[0]!.label).toBe("White");
  });

  it("takes every swatch colour from products.ts, so it cannot drift from stock", () => {
    for (const product of PRODUCTS) {
      for (const shot of colourwayShots(product.slug)) {
        const variant = product.variants.find((v) => v.color === shot.label);
        expect(variant, `${product.slug} has no variant named ${shot.label}`).toBeDefined();
        expect(shot.swatchHex).toBe(variant!.colorHex);
      }
    }
  });
});

describe("what every shot carries", () => {
  it("gives a printed shot the shape of its own plate", () => {
    // The tee's back plate is 900x1080 and the others are 900x1125. One
    // number for all of them mis-frames the tee's zoom.
    const tee = catalogueShots("tee").find((shot) => shot.view === "back")!;
    const hoodie = catalogueShots("hoodie").find((shot) => shot.view === "back")!;
    expect(tee.plateAspect).toBeCloseTo(900 / 1080, 4);
    expect(hoodie.plateAspect).toBeCloseTo(900 / 1125, 4);
  });

  it("leaves plateAspect null exactly where there is no plate", () => {
    for (const product of PRODUCTS) {
      for (const shot of catalogueShots(product.slug)) {
        expect(shot.plateAspect === null, `${product.slug}/${shot.view}`)
          .toBe(!shot.printed);
      }
    }
  });

  it("carries the source width the zoom ceiling needs", () => {
    for (const shot of catalogueShots("hoodie")) {
      expect(shot.sourceWidth).toBeGreaterThan(0);
    }
  });

  it("labels a view shot with its view and leaves it unswatched", () => {
    const shots = catalogueShots("hoodie");
    expect(shots[0]!.label).toBe("Back");
    expect(shots.every((shot) => shot.swatchHex === null)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run src/lib/garment-shots.test.ts
```

Expected: FAIL — `colourwayShots is not a function`.

- [ ] **Step 3: Extend `Shot` and the plate table**

In `src/lib/garment-shots.ts`, extend the interface:

```ts
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
   * The PLATE's own shape, which is not the photograph's and not a constant.
   * Null wherever plateUrl is. The zoom origin cannot be found without it.
   */
  plateAspect: number | null;
  /** The photograph's real width in pixels, for the zoom ceiling. */
  sourceWidth: number;
  /** What the control for this shot announces: a view name, or a colour name. */
  label: string;
  /**
   * The colour to fill this shot's control with, or null for a plain dot.
   * Present means "this control picks a colour", which is the whole of what
   * GarmentShots needs to know about which page it is on.
   */
  swatchHex: string | null;
}
```

Add the plate shape table beneath `plateFor`:

```ts
/**
 * Each plate's own shape, keyed by the file it comes from.
 *
 * NOT ONE NUMBER. The back print area is 280 x 350mm on the hoodie and
 * crewneck and 250 x 300 on the tee, so the tee's plate is 900 x 1080 where
 * the others are 900 x 1125. Handing the tee the hoodie's ratio puts its zoom
 * origin about 4% of the photograph off centre, which is a visible mis-frame.
 * Measured from the files, and asserted against them in the tests.
 */
const PLATE_SHAPE: Record<string, number> = {
  "/demo/plate-front.png": 600 / 818,
  "/demo/plate-back-hoodie.png": 900 / 1125,
  "/demo/plate-back-crewneck.png": 900 / 1125,
  "/demo/plate-back-tee.png": 900 / 1080,
};
```

- [ ] **Step 4: Extract one shot, then build both lists from it**

Replace `catalogueShots` at the bottom of the file with:

```ts
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
 * tile whose job is "here are four pieces and here is the range". Both start
 * on the hero colourway; see the note over HERO for why that ordering matters.
 *
 * Back only. The chest badge renders at 19 to 37px in a home tile, which is a
 * control promising something it cannot show. Owner decision, 18 August.
 */
export function colourwayShots(slug: ProductSlug): Shot[] {
  const product = getProduct(slug);
  const hero = heroColour(slug);
  if (!product || !hero) return [];

  const ordered = [
    ...product.variants.filter((variant) => variant.color === hero),
    ...product.variants.filter((variant) => variant.color !== hero),
  ];

  const shots: Shot[] = [];
  for (const variant of ordered) {
    const shot = shotFor(slug, variant.color, "back");
    if (!shot) continue;
    shots.push({ ...shot, label: variant.color, swatchHex: variant.colorHex });
  }
  return shots;
}
```

Update the imports at the top of the file:

```ts
import {
  garmentViewUrl,
  photoAspect,
  photoSourceWidth,
  type GarmentView,
} from "@/lib/garments";
import { getProduct, type ProductSlug } from "@/lib/products";
```

- [ ] **Step 5: Run the manifest tests**

```bash
npx vitest run src/lib/garment-shots.test.ts
```

Expected: PASS, including all the pre-existing assertions about view order and real files.

- [ ] **Step 6: Commit**

```bash
git add src/lib/garment-shots.ts src/lib/garment-shots.test.ts
git commit -m "feat: the home page varies colour where the shop varies view"
```

---

### Task 4: the control renders what the shot tells it to

**Files:**
- Modify: `src/components/products/GarmentShots.tsx`
- Test: `src/components/products/GarmentShots.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `src/components/products/GarmentShots.test.tsx`:

```ts
import { colourwayShots } from "@/lib/garment-shots";

describe("GarmentShots as a colour picker", () => {
  it("names each control after its colour", async () => {
    render(<GarmentShots shots={colourwayShots("crewneck")} slug="crewneck" />);
    const dots = screen.getAllByRole("button");
    expect(dots.map((dot) => dot.getAttribute("aria-label"))).toEqual([
      "Peach",
      "White",
      "Grey",
      "Olive",
    ]);
  });

  it("fills the control with the colour it selects", () => {
    render(<GarmentShots shots={colourwayShots("hoodie")} slug="hoodie" />);
    const swatch = screen
      .getByRole("button", { name: "Lilac" })
      .querySelector("span");
    expect(swatch).toHaveStyle({ backgroundColor: "#A898A6" });
  });

  it("tells a screen reader it is choosing a colour, not an aspect", () => {
    render(<GarmentShots shots={colourwayShots("hoodie")} slug="hoodie" />);
    expect(screen.getByRole("group")).toHaveAccessibleName("Which colour to show");
  });

  it("keeps saying aspect when the shots are views", () => {
    render(<GarmentShots shots={catalogueShots("hoodie")} slug="hoodie" />);
    expect(screen.getByRole("group")).toHaveAccessibleName("Which aspect to show");
  });

  it("switches the photograph when a colour is pressed", async () => {
    const user = userEvent.setup();
    render(<GarmentShots shots={colourwayShots("hoodie")} slug="hoodie" />);

    await user.click(screen.getByRole("button", { name: "Lilac" }));

    expect(screen.getByAltText(/hoodie in Lilac from the back/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run src/components/products/GarmentShots.test.tsx
```

Expected: FAIL — controls are named `Back` four times, and the group is named "Which aspect to show".

- [ ] **Step 3: Render from the shot**

In `src/components/products/GarmentShots.tsx`, replace the control block at the bottom. Three changes, one of them a real bug fix:

```tsx
      {shots.length > 1 ? (
        <div
          className="flex items-center justify-center gap-2"
          role="group"
          aria-label={
            shots[0]!.swatchHex ? "Which colour to show" : "Which aspect to show"
          }
        >
          {shots.map((option, optionIndex) => (
            <button
              // NOT option.view. Every colourway shot is a "back", so keying on
              // the view collapses four controls onto one React key and the
              // list stops updating correctly.
              key={option.label}
              type="button"
              aria-label={option.label}
              aria-pressed={showing === optionIndex}
              onClick={() => {
                setIndex(optionIndex);
                // Otherwise the hover offset immediately advances past the dot
                // the visitor just pressed, and the picture they asked for is
                // the one they cannot get to with a mouse.
                setHovered(false);
              }}
              className={cn(
                // THE DOT IS 6px TALL; THE BUTTON MUST NOT BE. These dots are
                // the touch affordance — hover is not something a phone has —
                // and a 6px target is a control only a mouse can use. The
                // padding is the hit area, the span is the thing you see.
                "group/dot flex items-center justify-center rounded-full px-1 py-3",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                "focus-visible:ring-offset-2 focus-visible:ring-offset-base",
              )}
            >
              {option.swatchHex ? (
                <span
                  // The inset border is not decoration. Hoodie White is #F3EFE9
                  // on a #EAE7E1 tile; without it a near-white swatch vanishes.
                  // CatalogueCard's own swatch row solves this the same way.
                  // Selection is a ring rather than a fill change, so it stays
                  // legible on white and grey too.
                  style={{ backgroundColor: option.swatchHex }}
                  className={cn(
                    "h-[13px] w-[13px] rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.16)]",
                    "transition-shadow",
                    showing === optionIndex &&
                      "shadow-[inset_0_0_0_1px_rgba(0,0,0,0.16),0_0_0_2px_var(--color-surface),0_0_0_3.5px_var(--color-accent-secondary)]",
                  )}
                />
              ) : (
                <span
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    showing === optionIndex
                      ? "w-5 bg-accent-secondary"
                      : "w-1.5 bg-line-strong group-hover/dot:bg-accent-secondary/60",
                  )}
                />
              )}
            </button>
          ))}
        </div>
      ) : null}
```

Delete the now-unused `viewLabel` import from this file — the label comes from the shot.

- [ ] **Step 4: Run it and watch it pass**

```bash
npx vitest run src/components/products/GarmentShots.test.tsx
```

Expected: PASS, both the new colour tests and the pre-existing view tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/products/GarmentShots.tsx src/components/products/GarmentShots.test.tsx
git commit -m "feat: a control that says which colour, when the shots are colours"
```

---

### Task 5: the lightbox

**Files:**
- Create: `src/components/products/PrintLightbox.tsx`
- Test: `src/components/products/PrintLightbox.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/products/PrintLightbox.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { catalogueShots } from "@/lib/garment-shots";
import { PrintLightbox } from "./PrintLightbox";

const shot = catalogueShots("hoodie").find((s) => s.view === "front")!;

describe("PrintLightbox", () => {
  it("is a dialog a screen reader can find and name", () => {
    render(<PrintLightbox shot={shot} slug="hoodie" onClose={() => {}} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName(shot.alt);
  });

  it("shows the photograph and the plate over it", () => {
    render(<PrintLightbox shot={shot} slug="hoodie" onClose={() => {}} />);
    expect(screen.getByAltText(shot.alt)).toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<PrintLightbox shot={shot} slug="hoodie" onClose={onClose} />);

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes when the close control is pressed", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<PrintLightbox shot={shot} slug="hoodie" onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: /close/i }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("takes focus when it opens, so the keyboard is inside it", () => {
    render(<PrintLightbox shot={shot} slug="hoodie" onClose={() => {}} />);
    expect(screen.getByRole("button", { name: /close/i })).toHaveFocus();
  });

  it("locks the page behind it and gives the scrollbar back on close", () => {
    const { unmount } = render(
      <PrintLightbox shot={shot} slug="hoodie" onClose={() => {}} />,
    );
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run src/components/products/PrintLightbox.test.tsx
```

Expected: FAIL — cannot resolve `./PrintLightbox`.

- [ ] **Step 3: Write the component**

Create `src/components/products/PrintLightbox.tsx`:

```tsx
"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { PLACEMENT, type GarmentSide } from "@/lib/garments";
import { plateCentre, zoomScale } from "@/lib/print-zoom";
import type { Shot } from "@/lib/garment-shots";
import type { ProductSlug } from "@/lib/products";

/**
 * The print, as large as this screen can honestly show it.
 *
 * FRAMES THE PLATE, NOT THE PHOTOGRAPH. A whole-garment lightbox puts the
 * chest badge at about 105px on a laptop, against the 67px it already is on
 * the card — a modal bought for 1.6x and still unreadable. The scale and the
 * origin both come from lib/print-zoom.ts.
 *
 * WHY THERE IS NO HYDRATION GUARD ON useReducedMotion, when Reveal.tsx needs
 * one and its comment says so at length. That guard exists because Reveal
 * renders on the server, where the hook answers null, and branching on the
 * first render left the server's opacity:0 stuck on the element. This
 * component is only ever mounted by a click, which cannot happen before
 * hydration, so there is no server render to disagree with. The guard would be
 * dead code here, not safety.
 */
export function PrintLightbox({
  shot,
  slug,
  onClose,
}: {
  shot: Shot;
  slug: ProductSlug;
  onClose: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [boxWidth, setBoxWidth] = useState(0);
  const reducedMotion = useReducedMotion() ?? false;

  const placement = shot.printed ? PLACEMENT[slug][shot.view as GarmentSide] : null;
  const scale = zoomScale({
    plateWidthPct: placement?.width ?? null,
    boxWidth,
    photoSourceWidth: shot.sourceWidth,
  });
  const origin =
    placement && shot.plateAspect
      ? plateCentre(placement, shot.aspect, shot.plateAspect)
      : { x: 50, y: 50 };

  // Measure the box so the scale can be a fraction of it. Layout effect so the
  // first painted frame is already framed, rather than snapping a tick later.
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => setBoxWidth(box.getBoundingClientRect().width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      // The dialog holds one control, so trapping is just refusing to let Tab
      // leave it. Anything more elaborate would be machinery for a focus ring
      // that has nowhere else to go.
      if (event.key === "Tab") {
        event.preventDefault();
        closeRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={shot.alt}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/95 p-4"
    >
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-md px-3 py-2 text-xs uppercase tracking-[0.12em] text-base/80 hover:text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary"
      >
        Close
      </button>

      <div
        ref={boxRef}
        onClick={(event) => event.stopPropagation()}
        style={{ aspectRatio: placement ? "1.2" : String(shot.aspect) }}
        className="relative h-[88vh] max-w-full overflow-hidden rounded bg-surface"
      >
        <div
          className="absolute inset-0"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: `${origin.x}% ${origin.y}%`,
            transition: reducedMotion ? "none" : "transform 320ms cubic-bezier(0.2,0.7,0.3,1)",
          }}
        >
          {/*
            The photograph's own shape, centred. Same nested-box rule as
            GarmentShots: plate placement is a percentage of the PHOTOGRAPH, so
            a box of any other shape puts the plate on the parchment beside the
            garment.
          */}
          <div
            className="absolute left-1/2 top-1/2 h-full max-h-full max-w-full -translate-x-1/2 -translate-y-1/2 isolate bg-surface"
            style={{ aspectRatio: shot.aspect }}
          >
            <Image
              src={shot.url}
              alt={shot.alt}
              fill
              // The photograph is drawn at up to MAX_UPSCALE times the box, so
              // asking for the box's width would fetch a candidate several
              // times too small. 100vw takes the largest the optimizer has;
              // it will not invent pixels past the file's own 1120 to 1400.
              sizes="100vw"
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
                <Image
                  src={shot.plateUrl}
                  alt=""
                  width={900}
                  height={1125}
                  sizes="60vw"
                  className="h-auto w-full"
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run it and watch it pass**

```bash
npx vitest run src/components/products/PrintLightbox.test.tsx
```

Expected: PASS, 6 tests. `ResizeObserver` is absent in jsdom — if the run reports `ResizeObserver is not defined`, add the same style of shim the setup file already uses for `IntersectionObserver`, in `vitest.setup.ts`:

```ts
// jsdom lacks ResizeObserver (used by PrintLightbox to measure its own box).
if (hasWindow && !("ResizeObserver" in window)) {
  class MockResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  // @ts-expect-error - assigning a minimal mock to the global.
  window.ResizeObserver = MockResizeObserver;
  // @ts-expect-error - keep global reference in sync for libraries reading it.
  global.ResizeObserver = MockResizeObserver;
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/products/PrintLightbox.tsx src/components/products/PrintLightbox.test.tsx vitest.setup.ts
git commit -m "feat: the print, as large as the screen can honestly show it"
```

---

### Task 6: wire the trigger, shop only

**Files:**
- Modify: `src/components/products/GarmentShots.tsx`
- Test: `src/components/products/GarmentShots.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `src/components/products/GarmentShots.test.tsx`:

```tsx
describe("GarmentShots zoom", () => {
  it("offers no zoom at all unless asked, so the home page is unchanged", () => {
    render(<GarmentShots shots={catalogueShots("hoodie")} slug="hoodie" />);
    expect(screen.queryByRole("button", { name: /enlarge/i })).not.toBeInTheDocument();
  });

  it("gives the picture a real button when zoomable, not a clickable div", async () => {
    render(<GarmentShots shots={catalogueShots("hoodie")} slug="hoodie" zoomable />);
    expect(screen.getByRole("button", { name: /enlarge/i })).toBeInTheDocument();
  });

  it("opens the lightbox on the shot being shown", async () => {
    const user = userEvent.setup();
    render(<GarmentShots shots={catalogueShots("hoodie")} slug="hoodie" zoomable />);

    await user.click(screen.getByRole("button", { name: /enlarge/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("enlarges whichever aspect the visitor switched to", async () => {
    const user = userEvent.setup();
    render(<GarmentShots shots={catalogueShots("hoodie")} slug="hoodie" zoomable />);

    await user.click(screen.getByRole("button", { name: "Chest print" }));
    await user.click(screen.getByRole("button", { name: /enlarge/i }));

    expect(screen.getByRole("dialog")).toHaveAccessibleName(/chest print/i);
  });

  it("closes again, and puts focus back where it came from", async () => {
    const user = userEvent.setup();
    render(<GarmentShots shots={catalogueShots("hoodie")} slug="hoodie" zoomable />);
    const trigger = screen.getByRole("button", { name: /enlarge/i });

    await user.click(trigger);
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run src/components/products/GarmentShots.test.tsx
```

Expected: FAIL — no button named `enlarge`.

- [ ] **Step 3: Add the prop and the trigger**

In `src/components/products/GarmentShots.tsx`, add to the props:

```tsx
  /**
   * Whether the picture opens a lightbox. Shop only.
   *
   * The home page does not get this: a modal on a teaser tile is a different
   * proposition from one on a product card, and the tile's job is the range,
   * not the detail. Owner decision, 18 August.
   */
  zoomable?: boolean;
```

Add the imports, the state, and the trigger. The image area becomes a `<button>` when zoomable and stays a plain `<div>` otherwise, so nothing about the home page changes:

```tsx
import { PrintLightbox } from "./PrintLightbox";
```

```tsx
  const [zoomed, setZoomed] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const closeZoom = () => {
    setZoomed(false);
    // Focus has to come back out of a dialog that is about to stop existing,
    // or it lands on <body> and the keyboard loses its place on the page.
    triggerRef.current?.focus();
  };
```

Wrap the existing picture block. Keep the whole inner stack exactly as it is; only the element around it changes:

```tsx
      {zoomable ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setZoomed(true)}
          aria-label={`Enlarge: ${shot.label.toLowerCase()}`}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          data-testid="garment-shots"
          className="relative flex w-full cursor-zoom-in items-center justify-center overflow-hidden bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base"
          style={{ aspectRatio: aspect }}
        >
          {picture}
        </button>
      ) : (
        <div
          data-testid="garment-shots"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className="relative flex w-full items-center justify-center overflow-hidden bg-surface"
          style={{ aspectRatio: aspect }}
        >
          {picture}
        </div>
      )}

      {zoomed ? (
        <PrintLightbox shot={shot} slug={slug} onClose={closeZoom} />
      ) : null}
```

Extract the inner stack — the photo-shaped box with the `<Image>` and the plate overlay — into a `const picture = (...)` above the return, unchanged, so both branches render the same thing.

Add `useRef` to the React import.

- [ ] **Step 4: Run it and watch it pass**

```bash
npx vitest run src/components/products/GarmentShots.test.tsx
```

Expected: PASS, all three describes.

- [ ] **Step 5: Commit**

```bash
git add src/components/products/GarmentShots.tsx src/components/products/GarmentShots.test.tsx
git commit -m "feat: the picture opens, on the page where looking closely is the point"
```

---

### Task 7: four equal squares on the home page

**Files:**
- Modify: `src/components/sections/ProductRange.tsx`
- Test: `src/components/sections/ProductRange.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `src/components/sections/ProductRange.test.tsx`:

```tsx
describe("the range, in colour", () => {
  it("offers no chest print, because it renders at 19px here", () => {
    render(<ProductRange />);
    expect(screen.queryByRole("button", { name: "Chest print" })).not.toBeInTheDocument();
  });

  it("gives the crewneck one control per colourway", () => {
    render(<ProductRange />);
    for (const colour of ["Peach", "White", "Grey", "Olive"]) {
      expect(screen.getByRole("button", { name: colour })).toBeInTheDocument();
    }
  });

  it("does not offer a lightbox on a teaser tile", () => {
    render(<ProductRange />);
    expect(screen.queryByRole("button", { name: /enlarge/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run src/components/sections/ProductRange.test.tsx
```

Expected: FAIL — a `Chest print` control is present.

- [ ] **Step 3: Square the tiles and cycle colour**

In `src/components/sections/ProductRange.tsx`: delete the `cellSpan` record entirely, swap the import to `colourwayShots`, and replace the grid body.

```tsx
        <div className="mt-10 grid gap-5 sm:grid-cols-2 md:grid-cols-4">
          {PRODUCTS.map((product, index) => {
            const price = formatZar(fromPriceZar(product));
            const href = `/products/${product.slug}`;
            const shots = colourwayShots(product.slug);

            return (
              <Reveal key={product.slug} delay={index * 0.08}>
                <div className="group flex h-full flex-col overflow-hidden rounded-lg border border-line bg-surface transition-colors hover:border-line-strong">
                  {shots.length > 0 ? (
                    <GarmentShots
                      shots={shots}
                      slug={product.slug}
                      /*
                        SQUARE, AND THAT IS WHY THE BENTO IS GONE. The shoot is
                        not one shape: the tee's White is portrait at 0.832 and
                        its Heritage Blue is LANDSCAPE at 1.26, a 51% swing, so
                        a cycling tile in any tall or wide box visibly resizes
                        the garment mid-cycle. A square sits almost exactly
                        between those two extremes and cuts the jump from 29
                        points to 4. It also lifts the space actually used from
                        64% to 83%, which was a separate complaint with the
                        same cause. A two-column square would be twice the
                        height of a one-column square, so the old spans could
                        not survive alongside it.
                      */
                      aspect="1 / 1"
                      className="p-3"
                      sizes="(min-width: 768px) 25vw, (min-width: 640px) 50vw, 100vw"
                      preload={product.slug === "hoodie"}
                    />
                  ) : (
                    <PhotoFrame
                      aspect="1 / 1"
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
              </Reveal>
            );
          })}
        </div>
```

- [ ] **Step 4: Run it and watch it pass**

```bash
npx vitest run src/components/sections/ProductRange.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/ProductRange.tsx src/components/sections/ProductRange.test.tsx
git commit -m "feat: four squares, each in the colours it comes in"
```

---

### Task 8: turn the zoom on where it ships

**Files:**
- Modify: `src/components/shop/CatalogueCard.tsx`
- Test: `src/app/shop/page.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `src/app/shop/page.test.tsx`, following the file's existing render helper:

```tsx
  it("lets a shop card open the print, which the home page does not", async () => {
    render(await ShopPage());
    expect(screen.getAllByRole("button", { name: /enlarge/i }).length)
      .toBeGreaterThan(0);
  });
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run src/app/shop/page.test.tsx
```

Expected: FAIL — no `enlarge` button.

- [ ] **Step 3: Pass the prop**

In `src/components/shop/CatalogueCard.tsx`, add `zoomable` to the `GarmentShots` call:

```tsx
        <GarmentShots
          shots={shots}
          slug={product.slug}
          aspect="4 / 5"
          className="p-4 pb-5"
          sizes="(min-width: 768px) 45vw, 100vw"
          zoomable
        />
```

- [ ] **Step 4: Run it and watch it pass**

```bash
npx vitest run src/app/shop/page.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Run everything, then lint and typecheck**

```bash
npx vitest run
```

```bash
npx tsc --noEmit && npx eslint src
```

Expected: full suite green, no type errors, no lint errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/shop/CatalogueCard.tsx src/app/shop/page.test.tsx
git commit -m "feat: the shop card opens the print it is selling"
```

---

### Task 9: see it running

Tests do not prove the framing is right; only looking does.

- [ ] **Step 1: Start the dev server and open `/shop`**

Use the preview tooling, not a bare shell command. Click a card's picture, then switch to the chest print and open it again.

- [ ] **Step 2: Check the numbers against the spec**

In the browser console with the lightbox open:

```js
(() => { const p = document.querySelectorAll('[role=dialog] img')[1];
  return p && p.getBoundingClientRect().width; })()
```

Expected: roughly 437px for the chest print at a 1200px box, roughly 744px for the back plate. Both against 67px and 238px before this change.

- [ ] **Step 3: Check the home page**

Four equal square tiles, the crewneck offering four colour swatches, no chest-print control anywhere, and the tee not resizing as it cycles into Heritage Blue.

- [ ] **Step 4: Check reduced motion**

With Reduce Motion enabled in the OS, the lightbox opens without the scale transition and — the thing that actually broke last time — the rest of the page is still visible.

---

## Notes for whoever executes this

- **Do not fix `LivePreview.tsx`'s `priority` prop.** It is known debt, recorded in `GarmentShots.tsx`'s own comment, and out of scope.
- **Do not make the shop card's colour swatches interactive.** §6 of the spec defers it deliberately; it moves `CatalogueCard` across the server/client boundary.
- **The `key={option.label}` change in Task 4 is load-bearing.** Keying on `option.view` collapses four colourway controls onto one key.
- **`plateAspect` is per file, not per product.** The tee's back plate is 900 × 1080 where the others are 900 × 1125.
