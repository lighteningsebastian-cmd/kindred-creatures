# Handover · 6 August 2026

**For Claude Code.** Three jobs, all unblocked. Everything else outstanding is waiting on
the owner (domain registration, company registration, prompt wording, print-shop answers,
samples) or on the reference illustration library, and none of it should be started here.

Sections 1 and 2 in either order. Section 3 is five minutes.

**Do not touch `src/lib/images/prompts.ts`.** The owner has that file open.

---

## 1. The cart shows a broken image

Carried over from `docs/spec-owner-review-5-aug.md` section 2b, which was written after the
last pass had already started. It is the only code item from that review still open, and the
full reasoning is there. Short version:

`src/components/cart/CartView.tsx` line 103 points at `/api/artwork/{id}/preview`. That
route 404s when `previewKey` is null, which is now always, so the customer sees the browser's
broken-image icon and the raw alt text.

**The portrait does not exist at cart stage and by design never will** — generation happens
after payment. So this is not the `frontKey` fix that section 2 applied to My Creatures. The
route is a leftover from pre-payment generation and should go.

- Show the garment photograph in the colourway they chose. The cart line already carries
  `productSlug` and `color` (`src/lib/cart-store.ts` lines 21 to 24) and
  `garmentImageUrl(slug, color, "front")` already returns it.
- `next/image` is fine here. The plain `<img>` existed only because the old path was a
  redirect.
- Delete `src/app/api/artwork/[id]/preview/route.ts`. `CartView` is its only caller.
- Update `CartView.test.tsx` line 52.
- Fix the alt text: it reads `Your portrait for the ${name}` where name is already
  `The Kindred Hoodie`, so it renders "for the The Kindred Hoodie". It is a garment photo
  now, so `${name} in ${item.color}`.

**Verify:** a cart line renders a picture, and the picture changes when the colourway does.

---

## 2. The legal pages · this is what PayFast approval is waiting on

Four pages do not exist. `src/components/layout/Footer.tsx` lines 18 and 19 point
`Shipping & returns` and `Privacy` at `href="#"`, and there is no Terms page at all. A dead
link in the footer is also the first thing a payment provider's reviewer clicks.

Build them as normal routes under `src/app`, in the existing page furniture, linked properly
from the footer:

| Route | Covers |
|---|---|
| `/privacy` | POPIA: what we collect, why, how long, who it goes to, how to ask for it or its deletion |
| `/terms` | Terms of sale. ECTA section 43 supplier disclosures |
| `/shipping-and-returns` | Delivery times, courier, costs, and the returns position |
| `/contact` | A real address, an email, and how long a reply takes |

### What must be true of the content

**Write real, specific copy — not a template with blanks.** Everything the pages need is
already established and should be pulled from the codebase and specs rather than invented:
the products and prices from `src/lib/products.ts`, the print shop in Jeffreys Bay, the
courier lead time of 7 to 10 working days **from approval**, PUDO's size-based tiers, the
approval step itself, and the two-automated-rounds-then-a-human revision process from
`docs/spec-pipeline.md`.

**Where a fact genuinely is not settled, leave a clearly marked `TODO(owner)` with the
question stated plainly.** Registered company name, registration number, VAT status and
physical address are not known yet and must not be guessed. A placeholder that reads like a
fact is worse than an obvious gap.

**The returns page is the one with a real question in it, and it must not be answered by
guessing.** These are personalised goods that cannot be resold, and the customer has already
approved the artwork before it printed. How South African consumer law treats that — the
cooling-off right, and what the exemptions actually cover — decides what this page can say.

So: **write the page around what we know we will do** (approval before printing, two
revision rounds, a person after that, and we replace anything that arrives damaged or wrong),
and raise the cooling-off question as an explicit `TODO(owner)` for a South African
commercial attorney to answer. Do not state a legal position. Do not copy one from another
store's page.

### The disclaimer that goes in the commit, not on the site

These are drafts for the owner to have reviewed before launch, not legal advice, and the
commit message should say so.

---

## 3. Narrow the `mixed breed` grep

`grep -rni "mixed breed" src` returns `src/lib/breeds.ts:97`, inside `ONE_OF_ONE_ALIASES`,
and the verify steps in `docs/spec-print-layout.md` section 7 and
`docs/spec-owner-review-5-aug.md` section 12 both demand it be empty.

**The alias is correct and stays.** That rule is about what we print and display, never
about what we listen for: a rescue owner who types the words they have always used has to
find their dog. The verify step overreached.

- Narrow both greps so they check rendered and stored strings, not the alias table.
- Put a one-line comment beside the alias saying why it is exempt, so the next person to run
  the old command does not delete it.
- Reasoning is in `docs/spec-owner-review-5-aug.md` section 13.

---

## Verify

```
npm run build
npx vitest run
npm run lint
```

Plus, by hand: click every footer link and confirm none of them goes to `#`.
