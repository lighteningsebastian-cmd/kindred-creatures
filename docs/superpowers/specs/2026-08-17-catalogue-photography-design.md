# Spec: photography on the home page and the shop

Owner decisions, 17 August 2026.

---

## Background: there are no pictures on the two pages that sell

The home page and `/shop` render zero photographs today. Both
`src/components/sections/ProductRange.tsx` and
`src/components/shop/CatalogueCard.tsx` render a `PhotoFrame`: the hatched
placeholder with an art-direction caption written for a shoot
("flatlay: the blue kindred hoodie laid flat with a dog portrait printed on
the chest, soft daylight, warm parchment backdrop"). That was the honest
treatment while there was nothing to show. There is now.

`public/garments/<product>/<colourway>/` holds 34 files across ten colourways:
`front`, `back` and `profile` everywhere, plus `fleece` on the hoodie. Only
`front` and `back` are reachable from code — `garmentImageUrl` builds no other
path — so `profile` and `fleece` have been sitting unused since the shoot.

The shoot is blank garments on white. That is exactly right for the customizer,
which needs a neutral surface to print a plate onto, and exactly wrong for a
catalogue card, which has to sell. This spec closes both gaps: it puts the
photographs on the pages, and it puts the print on the photographs.

---

## 1. What a card shows

**More than one aspect per item.** A single photograph cannot carry this
product. The back plate is the thing people buy and the chest print is the
thing they wear; showing one hides the other.

The view vocabulary, in the order a card offers them:

| View | What it is | Carries print |
|---|---|---|
| `back` | Flat back, the full companion profile plate | Yes |
| `front` | Flat front, the small chest print | Yes |
| `profile` | Three-quarter, standing, drawstrings and pocket visible | No |
| `worn` | A person wearing it | Yes, but baked into the photograph |
| `fleece` | Brushed-back texture, close | No |

**`back` is first.** The plate is the product. A card that opens on a blank
front is a card that opens on a plain hoodie.

**`profile` and `fleece` carry no plate, and must not be given one.** You
cannot see a chest print from the side, and a plate floated over a
three-quarter garment sits on air. The overlay is skipped for these views by
data, not by a special case in the component.

**`worn` has no files yet.** There is no on-model photography in this repo and
none of the pasted mockups are in it either. The view is part of the
vocabulary and has its place in the order, but it is not in any product's
manifest, so no card offers it. Dropping
`public/garments/<product>/<colourway>/worn.webp` in and adding `worn` to that
product's manifest line is the whole of the work to light it up. The manifest
lists only views that exist — never an aspiration — which is what lets §8's
"every url is a real file" test be an unconditional assertion.

### Views per product, today

- Hoodie: `back`, `front`, `profile`, `fleece` — four aspects
- Tee, crewneck: `back`, `front`, `profile` — three aspects
- Tote: none. It keeps its `PhotoFrame`, because it is deferred and has no
  shoot (`docs/spec-print-layout.md`).

### Hero colourway

One colourway fronts each card, and it is fixed rather than chosen by the
visitor. The colour dots on the catalogue card stay non-interactive, as they
are today; making them swap the photograph is a separate change and is not in
this scope.

| Product | Hero | Shape |
|---|---|---|
| Hoodie | Blue | 0.800 |
| Crewneck | Peach | 0.800 |
| Tee | White | 0.832 |

Chosen so all three cards are portrait and near-identical in shape. This is not
cosmetic: the tee's Heritage Blue and Olive shots are *landscape* (1.26 and
1.25), and leading with one would drop a wide garment into a grid of tall ones.

---

## 2. Fixing the shape map before building on it

`PHOTO_SHAPE` in `src/lib/garments.ts` records one shape per product and
colourway. Measured against the files, that is wrong: the shape varies by
**view** as well.

```
tee/olive   front   1400x1050   1.333
tee/olive   back    1400x1120   1.250     <- 6% out
tee/white   front   1144x1375   0.832
tee/white   profile 1313x1198   1.096     <- 32% out
```

Plate placement is a percentage of the photograph. Feed the front's shape to
the back's photograph and the back plate is measured against a box that is not
the picture, which slides it off centre vertically. On `tee/olive` that is
happening now, and the back plate is precisely what a catalogue card leads
with.

**Change `PHOTO_SHAPE` to be keyed by product, colourway and view**, populated
from measured file dimensions rather than assumption, and extend `photoAspect`
to take a view. `garmentImageUrl`'s existing `front | back` callers keep
working unchanged; the customizer's behaviour is unaffected except that
`tee/olive`'s back plate lands where it should.

The comment already standing over that map — that it must tell the truth about
what is on disk — is the reason this is in scope rather than deferred.

---

## 3. `src/lib/garment-shots.ts`

A new module, because the catalogue's question is not the customizer's
question. `garments.ts` answers "where does ink go on this garment"; this
module answers "which pictures does a card show, in what order, and what does
each one say to a screen reader". It imports `PLACEMENT` and `photoAspect`
rather than restating them.

```ts
export type GarmentView = "back" | "front" | "profile" | "worn" | "fleece";

export interface Shot {
  view: GarmentView;
  url: string;
  /** Real alt text, not the filename. */
  alt: string;
  /** Whether a plate is overlaid. False for profile, worn and fleece. */
  printed: boolean;
  /** The photograph's own shape, for the box it is drawn in. */
  aspect: number;
}

/** Ordered shots for a product's hero colourway. Empty for the tote. */
export function catalogueShots(slug: ProductSlug): Shot[];
```

`GarmentSide` in `garments.ts` stays `front | back`. It is the *print*
vocabulary — the two sides a plate can go on — and widening it to include a
texture crop would let a caller ask for the placement of a plate on a fleece
close-up. Views are a superset of sides, and the superset lives here.

Availability is a manifest in this file, not a filesystem probe: a server
component cannot stat a file on Vercel's edge, and a missing image must fail at
review time rather than as a broken frame in production.

---

## 4. Lifting the shoot onto parchment

The shots are on white. The brand is not.

Backgrounds measured at 253–255 across every file, with no vignette and no grey
halo, so `mix-blend-mode: multiply` over a parchment fill drops the background
to exactly `--parchment-50` and leaves the garment. No asset processing, no
second copy of 34 files, and it works on every colourway at once — including
any that arrive later.

The cost, stated plainly: multiply darkens. Mid-tone garments lose about 5%,
which reads as the garment sitting on a warm surface. White garments take the
parchment tint and read as cream rather than pure white. For a warm-stone brand
that is the right direction, but it is a real change to how a white hoodie
looks, and if the owner rejects it the fallback is a `sharp` script that
alpha-masks the white and recomposites — more faithful, at the cost of 34
generated files and a build step.

---

## 5. Putting the print on the photograph

The same technique the customizer uses, and deliberately the same numbers: the
photograph is a background, the plate is a transparent PNG positioned over it
by the percentages in `PLACEMENT`, and the garment colour shows through the
plate's transparency exactly as ink does on fabric.

**The catalogue must not get its own placement constants.** A shop card that
advertises a print in a different position from the one we make is a returned
parcel. It reads `PLACEMENT[slug][side]` and nothing else.

The demo plate is generated once, at build time, by
`scripts/build-catalogue-plate.ts`, using `backPlate`, `frontPlate` and
`composePlate` from `src/lib/print/plate.ts` — the production renderers, not a
copy. It writes `public/demo/plate-back.png` and `public/demo/plate-front.png`
and they are committed. Rendering per request would put `sharp` on the home
page's critical path for an image that never changes.

### The portrait

The plate needs an animal in it. The owner supplies one illustration as a
transparent PNG at `assets/demo-companion.png`; the build script composites it
and the committed plates carry it.

Until that file lands the script writes plates with an empty portrait area, so
the work is not blocked — but **the cards must not ship in that state.** The
plate typography renders beautifully around a hole where the dog belongs, which
is worse than the hatched placeholder it replaces, because it looks finished
and is not.

### The disclosure

`stockDisclosure` in `src/lib/companion.ts` exists because a stand-in
illustration has to be named as one. The demo companion on a catalogue card is
a stand-in by definition, so the card carries the same disclosure the live
preview does — once per grid, beneath it, not repeated on every card.

---

## 6. `<GarmentShots>`

One client component, used by both grids.

- Renders the first shot; hover swaps to the next on a pointer device, and a
  row of dots beneath the image does the same on touch. Both grids get both:
  hover is not a feature a phone has, and dots are not clutter a mouse notices.
- Swaps instantly, with no cross-fade. Each view is a different `src`, so the
  browser remounts the image; fading across a remount is a flash rather than a
  transition, and the honest cheap version is no transition at all. Nothing
  here needs a `prefers-reduced-motion` branch as a result, which is the reason
  to prefer it.
- Dots are real buttons with `aria-label`s naming the view ("Back", "Chest
  print", "Side", "Fleece"), and the image's `alt` updates with the shot. A
  card that changes picture silently is a card a screen reader cannot follow.
- The outer box is whatever the grid gives it; an inner box carries the
  photograph's own `aspect-ratio` and is centred inside it. This is not
  optional and is the one thing not to simplify: plate placement is a
  percentage of the photograph, so a box that is any other shape letterboxes
  the picture while the plate keeps measuring against the box, and the portrait
  ends up beside the garment. `GarmentView` in `LivePreview.tsx` carries the
  same structure and the same warning.

The hoodie's `fleece` shot is landscape (1.25) inside a portrait card, so it
letterboxes onto parchment. That is acceptable for a texture detail and needs
no special handling.

---

## 7. What this replaces

- `tileShot` in `ProductRange.tsx` — deleted, four art-direction briefs now
  fulfilled.
- `catalogueShot` in `CatalogueCard.tsx` — deleted, same.
- `PhotoFrame` survives, and is still the right answer for the tote, the Hero,
  `/about` and `/how-it-works`. This spec does not touch those pages.

---

## 8. Tests

- `garment-shots.test.ts`: view order per product; the tote returns empty; no
  shot claims `printed` for `profile`, `worn` or `fleece`; every returned `url`
  corresponds to a file that exists on disk (a test that reads the directory is
  correct here — it is the check that a manifest cannot drift from the shoot).
- `garments.test.ts`: extend for per-view shapes, with `tee/olive`'s front and
  back asserted as the different numbers they are.
- `GarmentShots.test.tsx`: renders the first shot; hover advances; the dot
  count matches the view count; alt text changes with the shot; a single dot
  renders no dot row.
- `shop/page.test.tsx` and any home-page assertions currently matching the
  placeholder captions will fail and need updating — that failure is the point.

---

## 9. Out of scope

- On-model photography and folded mockups. The slot exists; the files do not.
- Colour dots that swap the photograph.
- `/products/[slug]`, which has its own preview and is not a catalogue card.
- Re-shooting to one aspect ratio per product. Still worth doing eventually;
  §2 makes the code tell the truth in the meantime.

---

## Status, 17 August 2026

Built and verified in the browser. The home page and `/shop` show real
photography, several aspects per card, plate composited by the same placement
the customizer uses. Suite green, lint clean, `npm run build` clean with both
pages prerendering static.

Three things the build changed that this spec did not anticipate:

- **`priority` became `preload`.** Next 16 deprecated the former and AGENTS.md
  says to heed deprecation notices. `LivePreview.tsx` still passes `priority`;
  it predates the upgrade and is debt, not a pattern to copy.
- **The dots grew a hit area.** They were 6px tall, which is a control only a
  mouse can use, and they are the *touch* affordance. The visible dot is
  unchanged; the button around it is now 28 by 30.
- **`scripts/alias-loader.mjs` needed a third case.** `opentype.js` ships no
  `exports` field and a CJS `main` whose named exports Node cannot see, so the
  hook prefers `module` for packages in exactly that position. Packages that
  declare `exports` fall straight through untouched.

**The one thing outstanding is the portrait.** `assets/demo-companion.png` does
not exist, so every plate on every card has a hole where the animal belongs.
The typography renders correctly around it, which is exactly why this must not
ship as-is: it looks finished. Drop the illustration in, re-run

    node --import ./scripts/alias-loader.mjs scripts/build-catalogue-plate.ts

and commit `public/demo/`.

Also open, as taste rather than correctness: the two lead tiles on the home
page carry about a quarter of their width as parchment on each side, because
`3 / 2` cells hold `0.8` portrait photographs (measured fill 53%, 55%, 60%).
It reads as a catalogue plate rather than a mistake, but narrowing those cells
is a defensible alternative and the owner has not seen it yet.
