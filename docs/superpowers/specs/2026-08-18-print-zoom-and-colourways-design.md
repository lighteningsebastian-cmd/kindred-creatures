# Spec: seeing the print — zoom on the shop, colourways on the home page

Owner decisions, 18 August 2026.

---

## Background: the brand mark renders at 11% of the resolution we already have

The catalogue photography landed on 17 August
(`2026-08-17-catalogue-photography-design.md`). The pictures are on the pages
and the plates are on the pictures. What that spec did not measure is how
large the print actually comes out, and the answer is that it is too small to
read anywhere on the site.

Measured off the running dev server at 1280px:

| Surface | Photo box | Back plate | Front badge |
|---|---|---|---|
| `/shop` card | 518 × 648 | 238 × 298 | **67 × 92** |
| Home lead tile (hoodie, tee) | 284 × 355 | 131 × 163 | **37** |
| Home small tile (crewneck) | 146 × 182 | 67 × 84 | **19** |

The front badge is the worse of the two and it is the one that matters most.
`frontPlate` in `src/lib/print/plate.ts` builds it from three things: the
arced KINDRED CREATURES wordmark, **the companion's portrait**, and their
name. It is the brand mark and the drawing at once. At 67 pixels the wordmark
gets under 4px per letter on a curve and the portrait is a smudge roughly 40px
across. The source artwork is 600 × 818. We are displaying it at 11% of the
resolution sitting on disk.

The back plate is a specimen label — wordmark, breed, italic binomial, trait
line, an ORIGIN / GROUP / TOGETHER table, the companion's name. At 238px the
top two lines survive and the table does not. At 67px nothing does.

Two separate problems fall out of that, and they have separate answers:

1. **The shop needs magnification.** No amount of layout change fixes a badge
   that is 13% of the garment's width. That needs an actual zoom.
2. **The home page needs its space back.** The bento tiles ask for landscape
   boxes (`3 / 2`, `4 / 3`) and every garment photograph is portrait at 0.80.
   The inner box locks to the photograph's own shape, so it shrinks to fit the
   height and leaves **47% of a lead tile as bare parchment**. That is not a
   zoom problem. It is a shape mismatch, and the space is already paid for.

---

## 1. What changes

| | Today | After |
|---|---|---|
| Home tile shape | bento, `3 / 2` and `4 / 3`, hoodie and tee span 2 | **four equal squares**, every tile spans 1 |
| Home tile controls | view dots: back, front, fleece | **colourway swatches**: the back print in every colour it comes in |
| Home tile space used | 64% average, 53% worst | **83% average, 79% worst** |
| Shop card controls | view dots: back, front (+ fleece) | unchanged |
| Shop card zoom | none | **click either view to open a lightbox framed on the print** |
| Front badge, largest | 67px | **233 – 437px** |
| Back plate, largest | 238px | **233 – 744px** |

---

## 2. The home page: four squares, cycling colourways

### 2.1 The front view leaves the home page

A home tile offering a "Chest print" dot is advertising a 19 to 37 pixel badge.
The control promises something and then shows nothing. It goes.

That leaves the crewneck and tee with a single view each, which would make
those tiles completely static — no dots, no hover advance. The fix is not to
find another view. It is to change what the control varies.

**On the home page the dots vary colour. On the shop they vary view.** The
home page's job is "here are four pieces and here is the range"; the shop
card's job is "here is the print, and you can look closely". Each surface
varies the axis its job is about. This is cleaner than a surface flag on the
existing manifest, and §4 gives each axis its own function.

Every colourway on disk has `back.webp`, so the cycle is complete with no new
photography:

| Product | Colourways (hero first) |
|---|---|
| Hoodie | Blue, White, Lilac |
| Crewneck | Peach, White, Grey, Olive |
| Tee | White, Olive, Heritage Blue |
| Tote | none — keeps its hatched `PhotoFrame` |

`heroColour()` keeps its job and changes its meaning: it is no longer "the one
colourway a card fronts" but "the one it **starts** on". The reasoning in its
comment — lead with a portrait shot, avoid the parchment tint on white — still
decides the ordering, so that logic survives rather than being deleted.

### 2.2 Why square, and why the bento goes

Cycling colourways exposes a problem the single hero shot was hiding: the
shoot is not consistent in shape, and the tee is severe.

| Product | Aspect spread across colourways | Swing |
|---|---|---|
| Hoodie | 0.800 → 0.800 | 0% |
| Crewneck | 0.800 → 0.934 | 17% |
| **Tee** | 0.832 → **1.260** | **51% — portrait to landscape** |

The tee's White is portrait and its Olive and Heritage Blue are landscape. In a
fixed tile the garment visibly changes size mid-cycle. Measured across all ten
colourways:

| Tile shape | Avg tile used | Worst | Tee jump |
|---|---|---|---|
| Today's bento | 64% | 53% | 29 pts |
| Portrait 4/5 | 90% | 63% | 33 pts |
| **Square 1/1** | 83% | **79%** | **4 pts** |
| Landscape 5/4 | 74% | 64% | 33 pts |

**Square wins because it sits almost exactly between 0.80 and 1.26** — both
extremes fit it about equally, so the jump nearly vanishes. It also recovers
most of the wasted space as a side effect, because the same constraint caused
both problems.

Square costs the bento. A two-column square is twice the height of a
one-column square, so the asymmetric hoodie and tee spans cannot survive
alongside it; the grid becomes four equal tiles. This is a deliberate trade:
calmer and more catalogue-like, less editorial. A four-up row also reads
correctly against the section's own headline, "Four pieces, one portrait".

### 2.3 The dots become tinted swatches

The control renders as a filled circle in the colourway's own `colorHex`,
which `products.ts` already carries, matching the swatch row
`CatalogueCard.tsx` already draws.

- **13px circle**, `box-shadow: inset 0 0 0 1px rgba(0,0,0,.16)`. The inset
  border is not decoration: hoodie White is `#F3EFE9` against a `#EAE7E1`
  tile, and without it a near-white swatch disappears. `CatalogueCard` already
  solves this the same way and the treatment must match it.
- **Selected state is a camel ring**, not a fill change, so it stays legible on
  every colourway including white and grey.
- The plain-dot and swatch-plus-name variants were both built and rejected: a
  row of identical grey dots on a home tile would mean something different
  from the same row on a shop card with no visual distinction, and the visible
  name costs 26px of tile height (measured, 406 → 432) for a label most people
  read once.

The hit area rule from `1205e14` stands unchanged and is the reason the
swatch is a 13px span inside a padded button: the padding is the target, the
span is the thing you see. A 13px control is still a mouse-only control.

---

## 3. The shop: a lightbox framed on the print

### 3.1 The whole-garment lightbox does not work

A lightbox showing the whole hoodie at 92% of screen height puts the front
badge at roughly **105px on a 1080p laptop** — against the 67px it already is.
That is a modal, a focus trap and an escape handler to make the brand mark 1.6
times bigger and still unreadable. **The zoom frames the print, not the
photograph.** Everything below follows from that.

### 3.2 The geometry

The zoom origin is the centre of the plate, computed rather than hardcoded,
because it differs per product and per side:

```
originX        = placement.left + placement.width / 2
plateHeightPct = placement.width × photoAspect / plateAspect
originY        = placement.top + plateHeightPct / 2
```

For the hoodie front that gives `62.5%, 37.1%`.

The scale comes from a target *fraction* of the lightbox width, not a fixed
multiplier:

```
scale = TARGET_PRINT_FRACTION / (placement.width / 100)
```

**One formula serves both sides with no special case.** The front gives
`0.62 / 0.13 = 4.8×`; the back gives `0.62 / 0.46 = 1.35×`. Clicking the back
view opens something close to the whole garment and clicking the front opens
tight on the chest, and that falls out of the arithmetic rather than an `if`.
Because the target is a fraction of the box, portrait phones self-adjust and
**no mobile breakpoint is required**.

### 3.3 The upscale cap

The plate is a separate CSS layer over the photograph, never baked into it, so
zooming redraws the type crisp from its own source while only the fabric
behind it softens. That is favourable — the thing being magnified stays sharp
— but the fabric still has a limit.

Source widths are **not uniform** and must not be assumed: they run 1120 to
1400 across the ten colourways (crewneck Grey and Olive are 1211 and 1212, the
tee's Heritage Blue and Olive are 1400). The cap reads the actual width of the
file being shown, which is the second reason `PHOTO_SIZE` stores `w` and `h`
rather than a ratio. The hero colourways a shop card fronts are the narrowest
of them — 1120 on the hoodie and crewneck, 1144 on the tee — so the table
below is the worst case, not the average.

```
scale = min(TARGET_PRINT_FRACTION / plateWidthFraction,
            MAX_UPSCALE × photoSourceWidth / boxWidth)
```

`TARGET_PRINT_FRACTION = 0.62`, `MAX_UPSCALE = 3`. The cap governs the front on
large screens and never binds on small ones, which is why one constant covers
every viewport:

| Lightbox box | Front badge | Back plate | Fabric upscale |
|---|---|---|---|
| 1200px | 437px (capped) | 744px | ≤ 3.00× |
| 900px | 437px (capped) | 558px | ≤ 3.00× |
| 375px | 233px | 233px | ≤ 1.60× |

Against 67px and 238px today.

### 3.4 Both views are zoomable

`back` and `front` both open. The back's ~1.35× is a genuine magnification
(238 → 744px at desk width), not a no-op. `fleece` and any future `profile`
carry no plate; they open at the whole-garment framing, since `plateWidthPct`
is absent and the scale falls back to 1.

---

## 4. Module shape

**`src/lib/garment-shots.ts`** — two functions, one axis each:

- `catalogueShots(slug, colour)` — the views of one colourway. The shop's call.
- `colourwayShots(slug)` — the `back` shot of every colourway. The home's call.

`Shot` gains three fields:

- `plateAspect: number | null` — required by the zoom origin. **Not a
  constant:** the tee's back plate is 900 × 1080 (0.8333) while the hoodie's
  and crewneck's are 900 × 1125 (0.800). Assuming one number puts the tee's
  origin about 4% off centre. Measured from the files, same discipline as the
  photo shapes.
- `label: string` — what the control announces. A view name on the shop, a
  colour name on the home page.
- `swatchHex: string | null` — present means render a tinted swatch, absent
  means render a plain dot. This keeps `GarmentShots` free of any knowledge of
  which page it is on.

`PHOTO_SHAPE` becomes `PHOTO_SIZE: Record<string, { w: number; h: number }>`.
The zoom cap needs the source width in pixels and the aspect is `w / h`, so
storing the ratio alone would force a second table holding the same
measurements twice. `photoAspect()` derives from it and its callers are
unaffected.

**`src/lib/print-zoom.ts`** — new, pure, no React. `plateCentre()`,
`zoomScale()` and the two constants. All the arithmetic in §3 lives here so it
can be tested without rendering anything.

**`src/components/products/PrintLightbox.tsx`** — new client component. The
modal.

**`src/components/products/GarmentShots.tsx`** — gains `zoomable?: boolean`.
When true the image area is a real `<button>` that opens the lightbox; when
false nothing about it changes. Renders a swatch or a dot per `swatchHex`.

**`src/components/sections/ProductRange.tsx`** — four equal square tiles,
`cellSpan` deleted, calls `colourwayShots`.

**`src/components/shop/CatalogueCard.tsx`** — passes `zoomable`. Otherwise
unchanged.

---

## 5. Accessibility

- The zoom trigger is a real `<button>`, not a click handler on a div, with an
  `aria-label` naming what will be magnified.
- The modal carries `role="dialog"`, `aria-modal="true"` and is labelled by the
  shot's alt text.
- Escape closes. Focus moves into the dialog on open, is trapped while open,
  and returns to the trigger on close. Body scroll is locked.
- Every control keeps a real name: view dots announce the view, colourway
  swatches announce the colour. The swatch is never the only carrier of
  meaning.
- **Reduced motion uses the hydration guard from `Reveal.tsx`.** Branching on
  `useReducedMotion()` during the first render is what made every revealed
  section on the site permanently invisible for exactly the people who asked
  for less motion (`d02eb63`). The open transition collapses to instant, not to
  nothing, and the guard is not optional.

---

## 6. Deliberately not in this change

- **Interactive colourway swatches on the shop card.** Once the home page's
  swatches are clickable, the shop card's decorative swatch row looks
  identical and does nothing. That is a real inconsistency and the fix is to
  wire it to the same colourway switch — but it moves `CatalogueCard` across
  the server/client boundary and is a separate piece of work. Flagged here so
  it is not forgotten; not built now. It followed from the D2 decision rather
  than being chosen independently.
- **A hi-res artwork source.** The 600 × 818 front plate is what caps the zoom.
  A larger export would raise the ceiling; B2 does not need it.
- **`profile` on any surface.** The 17 August rule stands: a card offers only
  views that carry the print.
- **The tote.** No shoot, no plate, keeps its placeholder.
- **On-model `worn` photography.** Still absent, still one manifest line away.

---

## 7. Tests

**`print-zoom.test.ts`** — the arithmetic, with no rendering:

- `plateCentre` returns 62.5 / 37.1 for the hoodie front.
- The tee's 0.8333 back plate does not receive the hoodie's origin.
- Front scale exceeds back scale for every product.
- The back's scale is above 1 — the back view is a real magnification, not a
  no-op.
- The cap binds at 1200px and does not bind at 375px.
- Fabric upscale never exceeds `MAX_UPSCALE` at any box width from 320 to 2560.

**`garment-shots.test.ts`**:

- `colourwayShots` returns one shot per colourway, every one a `back`.
- Hoodie 3, crewneck 4, tee 3, tote 0.
- The first shot of each is the hero colourway.
- Every shot carries a `swatchHex` matching that variant's `colorHex` in
  `products.ts`, so a colour can never drift from stock.
- `catalogueShots` still returns views, still leads on `back`, still never
  includes `profile`.
- Every URL is a real file — the existing unconditional assertion, extended
  across all ten colourways.
- Every printed shot carries a non-null `plateAspect`.

**`PrintLightbox.test.tsx`** — opens on click, Escape closes, focus returns to
the trigger, `aria-modal` present, scroll lock applied and released.

**`GarmentShots.test.tsx`** — `zoomable={false}` renders no button, so the
home page is provably unchanged in that respect; a shot with `swatchHex`
renders a swatch and one without renders a dot; the control's accessible name
is the shot's label.

**`ProductRange.test.tsx`** — no "Chest print" control on the home page; four
tiles, none spanning more than one column; the crewneck offers four controls.

---

## 8. Decision log

| Decision | Owner call |
|---|---|
| Zoom interaction | Lightbox, framed on the chest, not the whole garment (B2) |
| Where it ships | Shop only |
| Front view on home tiles | Dropped |
| What home dots vary instead | Colourways, not views |
| Home tile shape | Square, four equal tiles; the bento is given up |
| Dot treatment | Tinted swatches (D2) |
| Back view zoomable | Yes |
