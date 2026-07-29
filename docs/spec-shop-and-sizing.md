# Spec: shop page, men's and women's fits, mobile cart dog

**For Claude Code. Read this whole file before writing code. Section 1 is a data-model
change that everything else depends on, so do it first and commit it on its own.**

Owner decisions, 28 July 2026.

---

## Background: why this is not just a UI change

The shop currently has four products, each with colour variants that all share one size
list. "Men's" and "Women's" do not exist in the model at all.

They have to, for a commercial reason as much as a sizing one: the women's crewneck and
the men's crewneck are **different garments at different costs** (R290 versus R350 for the
blank). They may carry different retail prices. Any design that treats fit as a display
label rather than real data will make that impossible.

---

## 1. Data model

**`src/lib/products.ts`**

Add a fit to the variant, not a new product slug.

```ts
/**
 * Garment fit. This is part of the VARIANT and not the product, because a fit
 * carries its own blank cost, its own size list and potentially its own price:
 * the women's crewneck blank costs R290 and the men's R350. Modelling fit as a
 * display label would make those facts unrepresentable.
 *
 * "unisex" means the garment has one cut for everyone (the hoodie) and must not
 * render a fit selector. It is not a third option alongside men's and women's.
 */
export type Fit = "womens" | "mens" | "unisex";

export interface Variant {
  color: string;
  colorHex: string;
  fit: Fit;
  sizes: string[];
  priceZar: number;
}
```

Keep `ProductSlug` as the existing four values. Do **not** split into `tee-mens` and
`tee-womens`: the slug is written into `order_items.product_slug` on every historical
order, into the cart store, into reorder, into the sitemap and into the print pipeline.
Changing it is a migration this change does not need.

### Fit per product

| Product | Fits | Sizes | Notes |
|---|---|---|---|
| Hoodie | `unisex` only | XS to XXL | Owner decision. One cut. No selector. Uses the men's fleece block. |
| Tee | `mens` | XS to XXL | Supplier's standard men's tee block. |
| Tee | `womens` | **XS to XL** | Supplier's TANNER block. Owner decision, 28 July. |
| Crewneck | `mens` | XS to XXL | Men's fleece block. |
| Crewneck | `womens` | **XS to XL** | **Hold back, see below.** |
| Tote | `unisex` | One size | No selector. |

**Women's garments have no 2XL.** The supplier's women's range stops at XL. Do not reuse
the shared `APPAREL_SIZES` constant for women's variants: define a separate
`WOMENS_SIZES = ["XS","S","M","L","XL"]` and use it. Offering a size that cannot be
supplied on a personalised, non-returnable garment is a refund waiting to happen.

**The women's crewneck must not go live yet.** The supplier publishes no measurements for
it, and the owner is requesting them. Build it in the data model, but keep it out of the
shop and off the fit tabs until real numbers arrive. Ship the range as: women's tee, men's
tee, men's crewneck, unisex hoodie, tote. Selling a garment whose size chart we cannot
publish is the one thing on this page that could cost real money.

Note on labels: the supplier calls the largest size `2XL`, this codebase calls it `XXL`.
Keep `XXL` in the UI and treat them as the same size.

### Helpers to add

```ts
/** The distinct fits a product actually offers, in display order. */
export function fitsFor(product: Product): Fit[];

/** True when the product needs a fit selector at all (more than one fit). */
export function hasFitChoice(product: Product): boolean;

/** Variants matching a fit. */
export function variantsForFit(product: Product, fit: Fit): Variant[];
```

### Back-compatibility, and this is the part that will bite

`order_items` has **no fit column**. Existing rows and the reorder path do not know about
fit.

1. Add `fit: text("fit")` to `orderItems` in `src/lib/db/schema.ts`, **nullable**, with an
   additive `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in `CREATE_TABLES_SQL` per the
   existing convention. Nullable is deliberate: historical rows genuinely have no fit and
   inventing one would be a lie in the data.
2. `CartItem` in `src/lib/cart-store.ts` gains `fit: Fit`.
3. **Reorder must not break on old orders.** Where a stored item has a null fit, resolve
   to the product's first available fit and let the customer change it before adding to
   cart. Never throw. Reorder currently works cross-product and that behaviour is pinned
   by tests in `src/lib/account/creatures` and the reorder flow tests.
4. Checkout re-derives every price server-side from `products.ts`. That lookup must now
   key on slug + colour + **fit** + size. Client prices stay untrusted. Do not weaken this.

---

## 2. Prices

Set in the same commit as the data model.

| Product | Fit | Retail |
|---|---|---|
| Tee | Women's | R599 |
| Tee | Men's | R599 |
| Crewneck | Women's | R799 |
| Crewneck | Men's | R899 |
| Hoodie | Unisex | R999 |
| Tote | Unisex | unchanged at R349, pending supplier quote |

Delete the placeholder warning comment at the top of the products file and replace it with
a note that prices are live as of 28 July 2026, derived from the pricing model in the repo
root, and that the tote alone is still a placeholder.

**Open owner question, flag do not decide:** the women's and men's crewneck are priced R100
apart because the blanks cost R60 apart. That is defensible but it is visible on the shop
page, where the two will sit side by side. The alternative is to price both at R849 and
average the margin. Ask before shipping.

**`src/lib/checkout.ts`**: `FREE_SHIPPING_THRESHOLD_ZAR` stays 1000. Flat shipping moves
from 99 to **95**. Provisional: it is set against PUDO locker-to-door, which is priced by
parcel dimensions, and the hoodie may not compress into the 8cm-deep S box. Leave a comment
saying so.

---

## 3. Shop page

**`src/app/shop/page.tsx`**

**The catalogue must be visible above the fold on mobile.** Right now a hero section and a
`StartFromPhotoBand` push the grid down; a visitor who came to look at products has to
scroll before seeing one. That is the whole point of this change.

1. Compress the hero to an eyebrow, an H1 and one line of subcopy. Remove the large top
   and bottom padding. Target: the first product card is at least partly visible on a
   390 x 844 viewport without scrolling.
2. Move `StartFromPhotoBand` to **below** the grid.
3. Add fit tabs directly under the H1: **All · Women · Men**. "All" is the default.
   - Filter by whether the product has a variant of that fit. A `unisex` product (hoodie,
     tote) appears under **every** tab, because it genuinely is for everyone. Do not hide
     the hoodie from the Women tab.
   - Tabs are client state. No route change, no query param needed.
   - The tab must be reachable and operable by keyboard, and use real `role="tab"`
     semantics rather than styled divs.
4. When a fit tab is active, a catalogue card linking to a product with that fit should
   carry the fit through: `/products/tee?fit=womens`.

Keep the existing `CatalogueCard`, the alternating vertical offset and the `ClosingCta`.
This is a re-order and a filter, not a redesign.

---

## 4. Product page

**`src/components/products/ProductConfigurator.tsx`** and **`ProductFlow.tsx`**

- Where `hasFitChoice(product)` is true, render a fit selector **above** colour, since fit
  narrows which colours and sizes are valid.
- Where it is false, render nothing at all. No "Unisex" pill, no disabled control. Silence
  is the correct UI for a choice that does not exist.
- Read `?fit=` from the URL the same way `?color=` and `?size=` are already read in
  `src/app/products/[slug]/page.tsx`, validate it, and pass it in as `initialFit`.
- Changing fit keeps the chosen colour if that colour exists in the new fit, otherwise
  falls back to the first available. Same pattern as the existing colour-change handler
  that preserves a still-valid size.
- The portrait step stays gated on a complete selection. With a fit choice present, that
  now means fit **and** colour **and** size before the customizer activates.

Copy for the selector label: `Fit`. Options render as `Women's` and `Men's`.

---

## 5. Size charts

Real measurements, from the supplier's published specs, 28 July 2026.

Source figures are in inches as **body width**, meaning the garment measured flat, which is
half the chest. The tables below give **chest circumference in centimetres** (body width
doubled, converted) because that is what a customer measures on themselves. Do not publish
the raw body-width figures: handing someone a number that is half their chest is how you
generate a size complaint.

Put these in `src/lib/sizing.ts` as data, not in JSX, so the product page and the size
guide cannot drift apart.

### Men's tee · XS to XXL

| | XS | S | M | L | XL | XXL |
|---|---|---|---|---|---|---|
| Chest (cm) | 95 | 100 | 105 | 110 | 116 | 121 |
| Length (cm) | 68 | 71 | 74 | 76 | 79 | 82 |

### Women's tee · XS to XL · TANNER

| | XS | S | M | L | XL |
|---|---|---|---|---|---|
| Chest (cm) | 91 | 96 | 102 | 107 | 112 |
| Length (cm) | 62 | 64 | 65 | 66 | 67 |

### Hoodie and men's crewneck · XS to XXL · fleece block

| | XS | S | M | L | XL | XXL |
|---|---|---|---|---|---|---|
| Chest (cm) | 104 | 109 | 114 | 119 | 127 | 135 |
| Length (cm) | 66 | 69 | 72 | 75 | 78 | 80 |

### Women's crewneck

No published spec. Do not invent one and do not reuse the men's block. Pending from the
supplier.

### The tolerance line, and why it must be there

The supplier's stated tolerance is **±1 inch, roughly 2.5cm**. On the men's tee, sizes are
only 5cm apart, so that tolerance is half a size. Saying nothing and then shipping a
garment 2cm off is how a personalised order that cannot be returned turns into an argument.

Under every size chart, in muted body text:

> These are garment measurements, not body measurements, and they can vary by about 2cm.
> If you are between sizes, we suggest sizing up. Still unsure? Send us a note before you
> order and we will help you choose.

That last sentence is not padding. On a non-returnable item, a question answered before
purchase is far cheaper than a reprint after it.

### Where the charts appear

1. **Product page**: a `Size guide` link beside the size selector, opening a modal with the
   chart for that product and fit only. Not all four charts. The customer is buying one
   garment.
2. **A `/size-guide` page** carrying every chart, linked from the footer, so it is
   indexable and linkable from customer emails.

---

## 6. Mobile cart dog

**`src/components/creatures/CartDog.tsx`** and the nav.

Owner decision from 27 July: on mobile the dog is not an animation. It sits permanently
visible above the cart basket, static. Desktop behaviour is unchanged.

- Below the `md` breakpoint: render the dog in its risen position at all times. No entry
  animation, no animation on cart change.
- At `md` and above: current behaviour, unchanged.
- The nav button box stays a fixed size with `overflow: visible`, exactly as now. No layout
  shift at any breakpoint. This constraint already exists in the component and is the
  thing most likely to break.
- Respect `prefers-reduced-motion` on desktop as it does today.

---

## 7. Verify before commit

```
npm run build
npx vitest run
npm run lint
grep -rn "—\|–" src --include=*.tsx --include=*.ts     # must be empty
```

Manual checks:

- Shop page on a 390 x 844 viewport: a product card is visible without scrolling
- Women tab shows women's tee, women's crewneck, hoodie, tote
- Men tab shows men's tee, men's crewneck, hoodie, tote
- Hoodie product page shows no fit selector
- Tee product page: switching fit keeps a valid colour and never leaves an invalid state
- Add to cart, then reorder that item, and confirm the fit survives
- Cart dog visible on mobile without interaction, nav does not shift

Commit in this order, each on its own: data model plus prices · shop page · product page ·
cart dog.
