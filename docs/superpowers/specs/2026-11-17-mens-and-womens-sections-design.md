# Design: men's and women's sections

Owner conversation, 16 and 17 November 2026. Supersedes sections 1 to 4 of
`docs/spec-shop-and-sizing.md` (28 July), which this keeps faith with but corrects on two
points: fit now has photography behind it, and the catalogue card is per fit rather than
per product.

---

## Intent

The range is already two ranges. The supplier shoot produced men's tees, women's tees,
men's crewnecks, women's crewnecks, unisex hoodies and a tote, and the site shows one
undifferentiated grid of four products. A visitor who wants the women's half cannot land
on it, cannot link to it, and on one garment cannot even see it: the crewneck is sold as
"Women's fit" while two of its four colourways are photographs of the men's sweater.

So this is not a filter laid over a catalogue. It is the catalogue finally carrying a
distinction the photography has had since July, and a pair of tabs that make the
distinction usable.

## Why now

Board item 9, carried since July. The commercial reason is in the July spec and still
holds: a women's crewneck blank costs R290 and a men's R350, so fit is a cost, a size run
and a price, not a label.

The urgent reason is new. Someone buying a Grey "Women's fit" crewneck today is looking at
a photograph of the men's one.

---

## What is true today

Measured, not assumed. Every published file was matched against its source in
`Stock Images/` by pixel dimensions.

| In the shop today | Is actually a photograph of |
|---|---|
| Tee: White, Olive, Heritage Blue | **Men's** tee (1144x1375, exact match) |
| Crewneck: Grey, Olive | **Men's** crewneck (1211x1299, exact match) |
| Crewneck: White, Peach | **Women's** crewneck (1122x1402 resized to 1120x1400) |
| Hoodie: Blue, Lilac, White | Unisex hoodie |
| Tote: Natural | Tote |

Shot and never published: the **women's tee** in Winter White, Peach and Blue, three views
each, and a women's crewneck in **Pea Green**, front only.

### Why they merged

`scripts/import-garments.mjs` has a `NOISE` set of filename words that carry no meaning,
and it contains `woman`, `women`, `mens` and `men`. The importer strips the fit out of the
filename and writes to `public/garments/<product>/<colour>/<view>.webp`. So
`Crewneck - Men - Grey-front.jpeg` and `Crewneck - peach - back.png` land as siblings under
one product, and the men's and women's sweaters become one garment with four colours.

The women's tees escaped only by accident: their files begin `Womens`, which is not in
`NOISE`, so they parse as a product called "womens" and were never written at all. The
Blue set is named `WhatsApp Image 2026-07-30 at 13.45.32.jpeg` and does not parse either.

### What exists in code

- `Fit` is `"unisex" | "womens"`, sits on the **product**, and is read in exactly one
  place: a label on `CatalogueCard`. It is a caption, not data.
- `src/app/api/checkout/route.ts:89` finds a variant by **colour alone**. Two fits sharing
  a colour name means the wrong price and the wrong garment on the job sheet. The crewneck
  has that collision already: men's White and women's White.
- `order_items` has no fit column, so no historical order records one.
- Photography resolves through `PHOTOS[slug][colour] -> { dir }` in `src/lib/garments.ts`,
  and `PHOTO_SIZE` and `PLACEMENT_OVERRIDES` key on `slug/dir/view`. Placement is a
  percentage of the photograph, and the men's and women's crewneck in White are different
  shapes (0.673 against 0.800), so one colour name cannot mean one placement.

---

## Goals

1. A visitor can see the men's range or the women's range on its own, and link to either.
2. Every swatch shows a photograph of the garment that will be sent, in the fit it is sold
   as.
3. Fit carries its own blank cost, size run and price.
4. Existing orders and reorders keep working, with no slug change and no backfilled lie in
   the data.

## Non-goals

- New product slugs. `order_items.product_slug` is on every historical order. The July
  spec ruled this out and it still holds.
- A redesign of `CatalogueCard`, the alternating grid offset or `ClosingCta`.
- Model or worn photography. There is none, for any fit.
- **The print pipeline.** Owner decision, 17 November 2026: both fits of a garment take the
  same print area. So `printArea` stays on the product rather than moving onto the variant,
  the `artworks` table needs no fit column, and `printPixels`, `artwork-drawing.ts`,
  `fulfillment.ts`, the plate preview route, the approve page and the job sheet's print
  size are all untouched by this change. Note that this is the area only. Where the plate
  SITS is a percentage of each photograph and still has to be measured per fit, which
  section 1.3 already requires.
- **The above-the-fold work in section 3 of the July spec.** Compressing the hero and
  moving `StartFromPhotoBand` below the grid is the other half of board item 9 and is a
  separate change. It is not done and should not be forgotten.

## Anti-goals

Things that would make this a failure even if it shipped and worked:

- A fit sold under a photograph of the other fit. That is the bug being fixed, and doing it
  on a page that now advertises the distinction is worse than doing it on one that does
  not.
- A published size chart we do not have measurements for.
- A reorder of an existing order that throws, or silently picks a fit the customer did not
  buy.

## Constraints

- Next 16.2.10, app router. `searchParams` is a Promise and is awaited, as
  `src/app/products/[slug]/page.tsx:109` already does.
- Prices are re-derived server side. Client prices stay untrusted.
- A swatch with no photograph behind it renders an empty frame on a R999 product and reads
  as a broken page. Every variant that reaches the shop needs its own photograph.
- No em dashes anywhere in `src`.

---

## Approaches

One product now has two sets of photographs, so something has to carry the fit from the
catalogue to the file on disk. Three ways:

**A. Thread `fit` through the photography API.** `garmentPhoto(slug, fit, colour)`,
and the same extra argument on `garmentImageUrl`, `garmentViewUrl`, `photoAspect`,
`photoSourceWidth` and `placementFor`. Every call site changes: `GarmentPreview`,
`GarmentShots`, `PrintLightbox`, `LineThumbnail`, `garment-shots.ts`, `dev/mockups` and
their tests. The `PHOTOS` map gains a level.

**B. The variant names its own photograph.** Move `dir` off the `PHOTOS` map and onto the
`Variant` in `products.ts` as `photoDir`, so a variant is the one thing that knows which
pictures it has. `PHOTOS` is deleted. Callers pass the variant they already hold rather
than a new argument: `GarmentPreview` and `GarmentShots` have it today, and the cart line
gains fit regardless, so `LineThumbnail` can resolve one.

**C. Make colour names unique per product.** Rename the men's crewneck White to something
else and change no code.

**Chosen: B.** It deletes a map rather than deepening one, and it puts the link between a
garment and its pictures in the file that defines the garment. A and B touch the same call
sites in practice, since both require the caller to know the fit; B is the one that leaves
the codebase smaller. C lets merchandising decide a technical key and would rename a real
colour for the wrong reason, and the collision would come back the first time two fits
share a colour again.

### Sequencing, owner's decision 17 November

Two pieces, landing separately, not one branch.

**Piece one is the catalogue.** The data model, the importer and the photography, so the
grid tells the truth. Nothing visible changes except that the crewneck stops showing the
wrong sweater and the women's tee appears.

**Piece two is the sections.** Tabs, the fit selector, size charts.

The mislabelled crewneck is live and is the kind of error that costs a refund on a
non-returnable garment, so it does not wait behind a tab component. It also means the tabs
filter data that is already trusted.

---

## Piece one: the catalogue tells the truth

### 1.1 The importer

`scripts/import-garments.mjs`. Fit stops being noise and becomes a path segment:

    public/garments/<product>/<fit>/<colour>/<view>.webp

- Remove `woman`, `women`, `mens`, `men` from `NOISE`. Recognise them, plus `womens` and
  `unisex`, as a **fit token** anywhere in the name, normalised to `womens`, `mens` or
  `unisex`.
- A file with no fit token takes the fit from its **source folder** (`Tees Men`,
  `Crewneck - Woman`, `Hoodies - Unisex`). The men's tees carry no fit in their filenames
  at all, so folder fallback is required, not a nicety.
- Default when neither says: `unisex`.
- The tote's one-file-two-views rule stands, under `tote/unisex/beige/`.
- The three women's tee Blue files do not parse. Rename them at source to
  `Womens - Tee - Blue - front.jpeg` and so on. Identify which is which by eye before
  renaming: getting back and front the wrong way round puts the large plate on the chest.

Then re-import everything with `--force`, unisex included, so every path has a fit segment
and there is one rule rather than two.

### 1.2 The catalogue

`src/lib/products.ts`. `Fit` becomes `"womens" | "mens" | "unisex"` and moves onto the
variant, which also carries its photo directory:

```ts
export interface Variant {
  color: string;
  colorHex: string;
  fit: Fit;
  /** This variant's photo directory, as "<fit>/<colour>" under its product. */
  photoDir: string;
  sizes: string[];
  priceZar: number;
}
```

The range:

| Product | Fit | Colourways | Sizes | Price |
|---|---|---|---|---|
| Hoodie | unisex | Blue, Lilac, White | XS to XXL | R999 |
| Tee | mens | White, Olive, Heritage Blue | XS to XXL | R599 |
| Tee | womens | Winter White, Peach, Blue | XS to XL | R599 |
| Crewneck | mens | White, Grey, Olive | XS to XXL | R899, see open question 1 |
| Crewneck | womens | White, Peach | XS to XL | R799 |
| Tote | unisex | Natural | One size | R349 |

**Women's sizes stop at XL.** The supplier's women's range has no 2XL. Define
`WOMENS_SIZES` separately rather than reusing the shared run. Offering a size that cannot
be supplied on a personalised, non-returnable garment is a refund waiting to happen.

**Pea Green is held back.** The women's crewneck was shot in Pea Green front only. The
back is where the large plate goes, so it cannot be sold. It stays out of `products.ts`
until the back and profile arrive, and goes on the shot list.

**White is now two colours.** The men's and women's crewneck both have one, and they are
different garments. Sample the men's White hex from its own photograph, middle of the
chest, neither highlight nor shadow, as the existing convention requires. The current
`#F3F0EC` was sampled from the women's photograph and stays with the women's variant.

Helpers, as the July spec defines them: `fitsFor(product)`, `hasFitChoice(product)`,
`variantsForFit(product, fit)`.

**The first variant is still the default colourway, and it is still load-bearing.** The
existing comment in `products.ts` explains why. It now means first within a fit: White for
the men's tee, Winter White for the women's.

### 1.3 Photography

`src/lib/garments.ts`.

- Delete `PHOTOS` and `garmentPhoto(slug, colour)`.
- `PHOTO_SIZE` and `PLACEMENT_OVERRIDES` key on `` `${slug}/${variant.photoDir}/${view}` ``.
- `garmentImageUrl`, `garmentViewUrl`, `photoAspect`, `photoSourceWidth` and
  `placementFor` take the variant (or its `photoDir`) in place of a colour string.
- **Re-measure every file.** Do not transcribe the existing numbers: the paths change, four
  entries move between products, and the women's tee is new. The existing test that reads
  the real files with sharp is what keeps this honest, and it must keep doing so.
- **Re-derive the crewneck placement overrides.** Today `crewneck/grey` and `crewneck/olive`
  carry overrides because they were shot nearer square than White and Peach. That was two
  fits in one product. Once they are the men's crewneck's only shots, the product's base
  placement should be calibrated to the men's framing and the overrides may fall away
  entirely. Check on `/dev/mockups` before deleting them.
- `unphotographedColours` keeps its job and must still return empty for every fit in the
  catalogue.

### 1.4 Carrying fit through an order

- `src/lib/db/schema.ts`: `orderItems` gains `fit: text("fit")`, **nullable**, with an
  additive `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in `CREATE_TABLES_SQL` per the
  existing convention. Nullable is deliberate. Historical rows genuinely have no fit and
  inventing one would be a lie in the data.
- `CartItem` in `src/lib/cart-store.ts` gains `fit: Fit`, and the persisted store's
  `version` goes from 1 to 2, which empties every cart a visitor is currently holding.
  **My call.** The version field is documented in that file as existing so a `CartItem`
  change can drop stale carts cleanly, and this is that change: a held line naming a
  crewneck colour that has moved fit, price and size run is not a line worth migrating.
  Crewneck White is genuinely ambiguous between the two fits, and Grey and Olive would
  re-price by R100. An emptied cart is recoverable by the customer. A silently wrong one
  is not.
- `src/app/api/checkout/route.ts`: the variant lookup keys on colour **and fit**. A body
  whose colour and fit do not name a real variant is rejected, as an unknown colour is
  today. Prices stay server-derived.
- **Reorder needs nothing built.** The July spec asked for a null fit to resolve to the
  first fit offering that colour. That describes a path which does not exist. `ReorderFlow`
  starts at `PRODUCTS[0].variants[0]` and never reads the stored line, and
  `ReorderableCreature` carries an artwork, a style and two plate URLs: no garment at all.
  "Wear it again" is a fresh choice of garment with an existing portrait. The requirement
  is therefore only that nothing throws on a null fit, which is already true. Do not build
  a resolver for it.
- The job sheet names the fit. The printer is pulling a specific blank off a shelf.

### 1.5 The catalogue card

**The six cards ship here, in piece one, before the tabs exist.** My call. The alternative
is keeping four cards until piece two, and a four-card grid has to pick one fit per
product, which would take the women's crewneck off the shop until the tabs land. Taking a
garment off sale to tidy an intermediate state is worse than a grid that briefly runs to
six. The H1 counts garments and not cards, so "Four canvases for your creature" stays true
with six cards under it. If it reads oddly to you it is a copy change, not a structural
one.

`CatalogueCard` already renders a fit label beside the size range. Two changes:

- The grid is **one card per product and fit**, not per product. Six cards: hoodie, men's
  tee, women's tee, men's crewneck, women's crewneck, tote.
- The card takes a product and a fit, and shows that fit's photograph, that fit's price and
  that fit's size range.

**This is my call, not the owner's, and it is the one worth checking.** A single card per
product would have to choose one fit's photograph and one fit's price, and with the
crewneck at R799 and R899 the "from" price would quietly advertise the cheaper sweater
while showing the other one. The July spec assumed one card per product because fit was a
label then. It is data now.

What the grid looks like, All tab, two up on desktop:

    The range
    Four canvases for your creature

    [ Hoodie            ]   [ Tee                 ]
    [ Unisex fit        ]   [ Men's fit           ]
    [ XS to XXL · R999  ]   [ XS to XXL · R599    ]

            [ Tee              ]   [ Crewneck            ]
            [ Women's fit      ]   [ Men's fit           ]
            [ XS to XL · R599  ]   [ XS to XXL · R899    ]

    [ Crewneck          ]   [ Tote                ]
    [ Women's fit       ]   [ One size · R349     ]
    [ XS to XL · R799   ]

### 1.6 The home page range

`src/components/sections/ProductRange.tsx` renders four tiles through `colourwayShots`,
which cycles **every variant of a slug** in one tile. Left alone, the crewneck tile would
cycle men's White, Grey and Olive, then women's White and Peach, showing two swatches both
labelled "White" and a single "from" price under whichever photograph came first. That is
the anti-goal of this document, on the busiest page of the site, so it is piece one and not
an afterthought.

**My call: the home grid stays four tiles and each tile cycles one fit only, the fit of the
product's first variant.** The owner already controls that through variant order, which
`products.ts` documents as a product decision rather than tidying, so this adds a lever
rather than inventing one. Order the arrays so each product leads with the fit it leads
with today: the tee with men's, which is the blank the home page already shows, and the
crewneck with women's, whose White and Peach are its current photographs. Nothing about the
home page changes visually on the day piece one lands, which is the point.

`heroColour` in `garment-shots.ts` then needs a lead colourway for each new fit. Its
documented criteria stand, including that white garments suffer under the parchment lift,
so the lead is not simply each fit's default colourway. Left to the builder.

### 1.7 Where the fit is visible

Once crewneck White is two garments at two prices, a line that reads "White · M" does not
say what was bought. **My call: the fit renders wherever a line renders**, not only on the
job sheet: cart lines, the order confirmation email
(`src/lib/email/templates/order-confirmation.ts`), the order status page
(`src/app/order/[token]/page.tsx`) and admin. A customer who cannot identify their own
garment from their own receipt is the refund conversation this change exists to prevent.

### 1.8 Structured data

Six cards against four product URLs. **My call:**

- `/shop`'s `ItemList` carries one entry per card, six, and the entries for a product with
  two fits point at `/products/<slug>?fit=<fit>` so each entry's price belongs to the thing
  it names. The existing rule in `shop/page.tsx`, that the markup and the grid cannot
  disagree, is what forces this.
- The product page keeps `/products/<slug>` canonical and its `Offer` becomes an
  `AggregateOffer` with `lowPrice` and `highPrice`. A single `Offer` quoting the cheapest
  variant would advertise R799 on a page that also sells the R899 sweater.
- The sitemap is unchanged. There are still four product pages.

### 1.9 Analytics

`src/lib/analytics.ts` keys events on the slug alone, so after this ships nobody could
answer whether the women's range sells, which is the commercial reason for the whole
change. **My call: the fit goes in as `item_variant` and `item_id` stays the slug**, so the
new dimension arrives without breaking continuity with the GA data already collected.

---

## Piece two: the sections

### 2.1 Shop tabs

`src/app/shop/page.tsx`.

- Tabs directly under the H1: **All · Women · Men**. All is the default.
- A card shows under a tab when its fit matches, and a `unisex` card shows under **every**
  tab, because it genuinely is for everyone. The hoodie and tote appear in all three.
- The fit lives in the URL as `?fit=womens`, read on the server the way `?color=` already
  is. A tab is a link, so a women's landing can be put in an ad or an email.
- **The canonical stays `/shop`.** No second indexable page, no duplicate content for the
  hoodie and tote.
- Real `role="tab"` semantics, keyboard operable, not styled divs.
- A card clicked under a tab carries the fit through: `/products/tee?fit=womens`.
- The `ItemList` structured data must list the same cards the grid renders, priced from the
  same source, so the markup and the page cannot disagree.

### 2.2 Product page

`ProductConfigurator` and `ProductFlow`.

- Where `hasFitChoice(product)` is true, a fit selector sits **above** colour, because fit
  narrows which colours and sizes are valid.
- Where it is false, render nothing. No "Unisex" pill, no disabled control. Silence is the
  correct interface for a choice that does not exist.
- Read `?fit=` the way `?color=` and `?size=` are read, validate it, pass it as
  `initialFit`.
- Changing fit keeps the chosen colour if that colour exists in the new fit, otherwise
  falls back to the first available, matching the existing colour-change handler that
  preserves a still-valid size.
- The portrait step stays gated on a complete selection, which now means fit and colour and
  size.
- Label: `Fit`. Options render as `Women's` and `Men's`.

### 2.3 Size charts

Measurements are in section 5 of the July spec and are not repeated here. They go in
`src/lib/sizing.ts` as data, not in JSX, so the product page and the size guide cannot
drift.

- Men's tee, women's tee, and the fleece block shared by the hoodie and men's crewneck.
- **The women's crewneck has no published spec.** Do not invent one and do not reuse the
  men's block. See open question 2.
- The tolerance line goes under every chart, in muted body text, exactly as the July spec
  words it. The supplier's tolerance is about 2.5cm and the men's tee sizes are 5cm apart,
  so the tolerance is half a size, and saying nothing then shipping 2cm off is how a
  non-returnable order turns into an argument.
- A `Size guide` link beside the size selector opens a modal with the chart for that garment
  and fit only.
- A `/size-guide` page carries every chart, linked from the footer, so it is indexable and
  can be linked from customer emails.

---

## Open questions for the owner

Ranked. Answered so far: the print area, 17 November, recorded under Non-goals.

1. **What happens to anyone who has already bought a Grey or Olive crewneck?** They bought a
   garment the site labelled "Women's fit" at R799, having been shown a photograph of the
   men's sweater. After this change that colourway is the men's crewneck. Orders already
   paid and not yet printed carry a null fit, so the job sheet names no fit for exactly the
   garment whose fit was wrong. The options are to backfill those rows from what the
   customer was actually shown (Grey and Olive to men's, White and Peach to women's, which
   is fully determined), to hold those orders and contact the customers, or to send the
   printer a note. This is yours because it decides what a real person receives.

2. **Crewneck pricing.** Men's R899 against women's R799, R100 apart because the blanks are
   R60 apart, and with one card per fit the two now sit in the same grid. The alternative is
   R849 on both and an averaged margin. Note what the reviewer caught: Grey and Olive
   retail at R799 today, so pricing the men's crewneck at R899 is a live price rise on two
   colourways, not just a new number. Flagged in the July spec as "ask before shipping".
   **Gates piece one**, because it sets a figure in `products.ts`.

3. **Colourway names for the women's tee.** The shoot calls them Winter White, Peach and
   Blue, sitting beside a men's tee in White and Heritage Blue. Are those the retail names?
   The answer sets the import paths and decides which photograph each hex is sampled from,
   and the Winter White files are named only `white` at source. **Gates piece one.**

4. **The women's crewneck size chart.** The July spec said hold the garment until the
   supplier publishes measurements. It is live, in White and Peach, with no chart anywhere
   on the site. Either the measurements arrive before piece two, or the garment comes off
   the shop until they do. Piece two cannot ship a size guide with a hole in it.
   **Gates piece two only.**

---

## Left to the builder

- Sampling each new hex from the middle of the chest of its own photograph.
- Whether the crewneck placement overrides survive re-measurement, judged on
  `/dev/mockups`.
- Identifying front, back and profile in the three unnamed women's tee Blue files, by eye,
  before renaming them.
- Test structure throughout. The existing tests that read real image files are the pattern
  to follow, not to replace.

## Verify before commit

```
npm run build
npx vitest run
npm run lint
grep -rn "—\|–" src --include=*.tsx --include=*.ts     # must be empty
```

Manual checks:

- Every swatch on every product shows that fit's garment. Check the crewneck in White
  twice, once per fit, and confirm they are different photographs.
- `/dev/mockups`: every plate sits on the garment, not beside it, for all six fits.
- Women tab shows women's tee, women's crewneck, hoodie, tote. Men tab shows men's tee,
  men's crewneck, hoodie, tote.
- `/shop?fit=womens` loads the women's tab directly, and the canonical is still `/shop`.
- Hoodie product page shows no fit selector. Tee switches fit without reaching an invalid
  state.
- Add to cart, reorder that item, and confirm the fit survives.
- An order placed before this change still reorders without throwing.
