# Copy pass: Jeffreys Bay, the delivery promise, and How it works

**For Claude Code. Every change below is exact: old string, new string, file.**

Owner decisions, 27 July 2026:

- Blanks come from **The Blank Brand** in Jeffreys Bay. Printing is by **Red Hot Prints**,
  also in Jeffreys Bay. The owner collects the garment the same day and carries it to the
  printer himself.
- Location reads as **Jeffreys Bay**, by name.
- Delivery promise is a **deliberately wide range: 7 to 10 working days**. It replaces the
  old "5 working days", which was never achievable.

## Rules

1. No em dashes or en dashes. `grep -rn "—\|–" src --include=*.tsx --include=*.ts` must be
   empty before commit. Middot is fine.
2. Never "AI", "generate", "generated" in customer-facing copy.
3. Tests assert several of these exact strings. Update the assertion to the new string.
   Never delete the assertion.
4. Emotion belongs in visible copy. Page titles, meta descriptions, JSON-LD and llms.txt
   keep plain search language. Only the location and the delivery number change there.

---

## 1. The constants

**`src/lib/content.ts`**

Replace:

```ts
/** The delivery promise, stated once. Five working days, from approval. */
export const DELIVERY_DAYS = 5;
```

With:

```ts
/**
 * The delivery promise, stated once.
 *
 * Measured from approval, not from order, because the customer controls when
 * they approve.
 *
 * IMPORTANT: this is a typical case, never a guarantee. Every surface must say
 * "most orders" and "about", because the courier leg is not ours to promise and
 * outlying areas run longer. A missed delivery promise costs a refund, a review
 * and the referral behind it. Do not let this harden into "delivered in 5
 * working days" anywhere.
 */
export const DELIVERY_DAYS = 5;

/** "about five working days". The only phrasing of the promise anywhere. */
export const DELIVERY_WINDOW = "about five working days";
```

Then fix every `DELIVERY_DAYS` reference to use `DELIVERY_WINDOW`.

---

## 2. Home page: How it works teaser

Owner decision: this stays a **light tease** that sends people to `/how-it-works`. But it
currently renders only three single words and no body copy, so it takes a full screen and
says almost nothing. Render the bodies.

**`src/lib/content.ts`** · `HOW_IT_WORKS_STEPS`

```ts
export const HOW_IT_WORKS_STEPS: HowItWorksStep[] = [
  {
    key: "upload",
    title: "Meet",
    body: "Introduce us to your best friend.",
  },
  {
    key: "approve",
    title: "Create",
    body: "We craft a portrait worthy of them.",
  },
  {
    key: "unbox",
    title: "Celebrate",
    body: "Wear them. Gift them. Treasure them.",
  },
];
```

Keep the `key` values unchanged. They drive the icon map in `HowItWorks.tsx` and the
HowTo JSON-LD, and renaming them touches more than this pass needs to.

**`src/components/sections/HowItWorks.tsx`**

- Heading: `From your camera roll to your wardrobe`
  → `From your favourite photo to something you keep`
- Render `step.body` under `step.title`. It exists and is currently thrown away.
- Add the step number as a small eyebrow above each title: `01` `02` `03`. Three boxes in
  a row do not read as a sequence without it, and the sequence is what builds the trust to
  hand over a photo.
- Button: `See how it works` → `See how it happens`

---

## 3. The `/how-it-works` page

**`src/lib/content.ts`** · `HOW_IT_WORKS_PAGE_STEPS`

```ts
export const HOW_IT_WORKS_PAGE_STEPS: HowItWorksPageStep[] = [
  {
    key: "upload",
    title: "Share the photo that captures them best",
    body: "Good light and a clear look at their face is all we need. If you are torn between two, send both and we will tell you which one will make the better portrait.",
  },
  {
    key: "draw",
    title: "We craft their portrait",
    body: "Your photo becomes artwork in the style you choose, hand-finished and framed with care, so it looks like them and not like a filter.",
  },
  {
    key: "approve",
    title: "You say yes, or you say not quite",
    body: "The portrait comes back to you before anything is printed. If the first one is not quite them, we rework it until it is. Nothing reaches the press without your word.",
  },
  {
    key: "ship",
    title: "We make it, and send it home",
    body: `Your piece is made to order in Jeffreys Bay, finished and checked over by hand, then packed to travel. Most orders reach their door within ${DELIVERY_WINDOW}, tracked the whole way.`,
  },
];
```

**On what this step does not say.** Earlier drafts described collecting blanks and walking
them to a printer. That is out, by owner decision, and rightly so. The customer is buying
a keepsake, not a supply chain. Suppliers are never named on any customer-facing surface.
Say "we make it" and mean the whole of it.

```
```

**`src/app/how-it-works/page.tsx`**

- `description` meta: replace `prints it in Cape Town within ${DELIVERY_DAYS} working days`
  → `prints it in Jeffreys Bay and delivers within ${DELIVERY_WINDOW}`
- Step body at line ~60: `Every piece is printed in Cape Town on premium blanks, then checked over by hand before it is packed to travel.`
  → `Every piece is printed in Jeffreys Bay on premium blanks, checked over by hand, and packed to travel.`
- Line ~239: `Printed in Cape Town · Delivered in {DELIVERY_DAYS} working days`
  → `Printed in Jeffreys Bay · Delivered in {DELIVERY_WINDOW}`

---

## 4. The delivery promise section

**`src/components/sections/DeliveryPromise.tsx`**

This is the section the change is really about. The old version promised a number you
cannot keep. The new one trades that number for the thing no large competitor can copy.

- Eyebrow: `Printed in Cape Town` → `Made in Jeffreys Bay`
- Heading: `Printed and delivered in 5 working days`
  → `With you in about five working days`
- Body: replace with:

> Most orders reach their door within five working days. Yours is made to order, checked
> over by hand before it is packed, and tracked from the moment it leaves us.

Note the wording. It says **most orders** and **about**, not a guarantee, because the
courier is not ours to promise. Do not tighten this to "delivered in 5 working days" in
any surface: that sentence is a commitment the business cannot keep for outlying areas.

---

## 5. Every remaining "Cape Town" and "5 working days"

Straight replacements. Location becomes Jeffreys Bay, the promise becomes the window.

| File | Change |
|---|---|
| `src/app/layout.tsx` (3 places, lines ~50, ~59, ~68) | `in Cape Town, and courier it to you in 5 working days` → `in Jeffreys Bay, and courier it to you within 7 to 10 working days` |
| `src/app/page.tsx` line ~30 | `we print it in Cape Town and courier it to your door` → `we print it in Jeffreys Bay and courier it to your door` |
| `src/app/about/page.tsx` line ~50 | heading `Printed in Cape Town` → `Printed in Jeffreys Bay` |
| `src/app/about/page.tsx` line ~52 | `a print shop in Cape Town that treats each garment as a single piece of work` → `a print shop in Jeffreys Bay that treats each garment as a single piece of work` |
| `src/app/about/page.tsx` line ~85 | `crewneck or tote in Cape Town` → `crewneck or tote in Jeffreys Bay` |
| `src/app/about/page.tsx` meta | `printed in Cape Town` → `printed in Jeffreys Bay` |
| `src/app/shop/page.tsx` line ~13 | `each printed in Cape Town` → `each printed in Jeffreys Bay` |
| `src/app/products/[slug]/page.tsx` line ~40 | `Printed in Cape Town and couriered to your door in 5 working days.` → `Printed in Jeffreys Bay and couriered to your door within 7 to 10 working days.` |
| `src/app/products/[slug]/page.tsx` line ~86 | `Once you say yes, we print and courier it, ready in 5 working days.` → `Once you say yes, we print it, check it over and send it on its way.` |
| `src/app/products/[slug]/page.tsx` line ~154 | `Printed in Cape Town and couriered anywhere in South Africa in 5 working days` → `Printed in Jeffreys Bay and couriered anywhere in South Africa within 7 to 10 working days` |
| `src/app/journal/page.tsx` lines 8, 52 | `Cape Town print operation` → `Jeffreys Bay print operation`; `printing apparel by hand in Cape Town` → `printing apparel by hand in Jeffreys Bay` |
| `src/app/order/[token]/page.tsx` lines 50, 56 | `print shop in Cape Town` → `print shop in Jeffreys Bay`; `courier it to you within 5 working days` → `courier it to you within 7 to 10 working days` |
| `src/app/llms.txt/route.ts` lines 48, 54, 70 | `a print shop in Cape Town` → `a print shop in Jeffreys Bay`; `Printed in Cape Town, couriered anywhere in South Africa.` → `Printed in Jeffreys Bay, couriered anywhere in South Africa.` |
| `src/app/dev/creatures/CreaturesDemo.tsx` lines 24, 27 | same substitutions |
| `src/lib/content.ts` FAQ, "How long until it arrives?" | → `Most orders reach you within 7 to 10 working days from the moment you approve the portrait. Everything is printed in Jeffreys Bay and couriered to your door, tracked the whole way.` |

Where the old copy read `5 working days`, the new copy reads `most orders reach you within
about five working days` in body text, or `${DELIVERY_WINDOW}` where a phrase is being
interpolated. Never bare "in 5 working days".

---

## 5b. Free shipping threshold moves to R1,000

Owner decision, 27 July 2026. The threshold was R750, which sat below the hoodie at R899,
so the most expensive item in the range shipped free and the business absorbed the whole
courier cost on it. R1,000 puts every single-item order above the line.

**`src/lib/checkout.ts`**

```ts
export const FREE_SHIPPING_THRESHOLD_ZAR = 1000;
```

Update the comment above it, which currently cites the R750 promise.

**`src/components/layout/Nav.tsx`** line 25

`DESIGNED AND PRINTED IN SOUTH AFRICA · FREE SHIPPING OVER R750`
→ `DESIGNED AND MADE IN SOUTH AFRICA · FREE SHIPPING OVER R1000`

Check for tests asserting 750 or the free-shipping boundary in `src/lib/checkout.test.ts`
and any cart or checkout test, and move the boundary cases to 1000. The boundary
assertions matter: an order at exactly R1,000 ships free, R999 does not.

---

## 6. Tests to update

Change the expected string, never remove the assertion.

- `src/app/llms.txt/route.test.ts` lines 37, 38 · expects `"Cape Town"` and `"5 working days"`
- `src/app/order/[token]/page.test.tsx` lines 115, 116 · matches `/Cape Town/` and `/5 working days/`
- `src/app/about/page.test.tsx` lines 23, 25 · `/Printed in Cape Town/`, `/couriered anywhere in South Africa in 5 working days/`

Test fixtures using `city: "Cape Town"` as a customer delivery address are **not** part of
this change. A customer in Cape Town is still a customer in Cape Town. Leave them.

---

## Verify before commit

```
npm run build
npx vitest run
npm run lint
grep -rn "—\|–" src --include=*.tsx --include=*.ts        # must be empty
grep -rni "cape town" src --include=*.tsx --include=*.ts   # only address fixtures may remain
grep -rn "in 5 working days"  src                          # must be empty
grep -rn "R750\|= 750"        src                          # must be empty
```
