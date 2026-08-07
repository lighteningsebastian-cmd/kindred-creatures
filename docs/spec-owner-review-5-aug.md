# Owner review, 5 August 2026 · fourteen changes after the first real artwork

> **STATUS, 5 August, evening. Delivered in commits `abe29b5` to `d3c3aeb`.**
>
> Everything below is built and committed **except section 2b**, which was written after
> Claude Code had already started and is the only item still open.
>
> **One correction to this document, and the error is mine.** Section 4 says
> `CompanionForm.tsx` is dead code and should be deleted. It is not: `ProductFlow.tsx`
> line 6 imports it for the edit stage, added in `e991690`. Claude Code was right to update
> it rather than follow the instruction. The claim came from a stale note of mine and was
> not re-checked before it went into this brief.
>
> Two questions came back and are answered at the foot of this file, section 13.

**For Claude Code.** Owner viewed the first genuinely generated front and back plates
(order `F0379EB0`, artwork `b025ee59`) and gave the list below. Consistency across
generations was singled out as working: **do not touch `prompts.ts` in this pass.** The
owner is revising the prompt himself.

Work in the numbered order. Sections 1 to 4 are wrong-on-the-garment or wrong-to-the-
customer and everything else is behind them.

---

## 1. The customer is told the wrong thing after paying · worst item on the list

**This is the one that costs trust.** Generation moved to after payment (owner decision,
2 August), and the customer is now promised an approval email before anything is printed.
Three places still tell them their order went straight to the press.

### 1a. `src/app/order/[token]/page.tsx`

`PRESENTATION.paid` currently reads:

> Thank you. Your creature is off to be printed.
> PayFast has confirmed your payment, so your portrait is on its way to our print shop in
> Jeffreys Bay…

That is false. At `paid`, the portrait has just been drawn, or is being drawn, and an
approval mail is going out. Nothing has been sent anywhere.

**Rewrite `paid` so it says, in the brand's voice:**

- payment is confirmed
- we are drawing their creature now, which takes a few minutes
- an email arrives with the artwork for them to approve
- **nothing is printed until they say yes**
- the 7 to 10 working days starts after they approve, not now

The other statuses are correct as written. `sent_to_printer` genuinely means approved and
away, so leave it. Do not touch `pending` or `flagged`: both were written carefully for a
customer having a bad moment and both are still accurate.

### 1b. `src/lib/account/creatures.ts`

`CUSTOMER_ORDER_STATUS_LABEL.paid` reads `"Paid, off to be printed"`. Same lie, shorter.
Something like `"Drawing your creature"` — short enough for a compact list, and true.

### 1c. `src/lib/email/templates/order-confirmation.ts`

This is the mail that lands within seconds of payment, so it is the first place the promise
is made or broken. Currently:

- heading: `Thank you, your portrait is on its way to print.`
- preheader: `We have your order and your portrait is heading to the print shop.`
- WHAT HAPPENS NEXT: *"Your portrait goes to our print shop in Jeffreys Bay…"*

All three are wrong. The "what happens next" block must be the approval step: we are
drawing it, a second email follows with the artwork, they approve, and only then does it go
to Jeffreys Bay. Keep the 7 to 10 working days figure but attach it to **after approval**.

Change the HTML body, the plain-text body, the subject if it needs it, the heading and the
preheader. `src/lib/email/templates/approval.ts` is already correct and says *"nothing is
printed until you are happy with it"* — match that sentence's promise exactly, do not invent
a second wording for it.

**Verify:** grep for the phrase after the change.

```
grep -rn "off to be printed\|on its way to print\|heading to the print shop" src
```

Must return nothing outside `sent_to_printer` and later.

---

## 2. "My Creatures" shows a paw print instead of the artwork · a real bug

`src/app/account/page.tsx` falls back to a `<PawPrint>` icon when `previewUrl` is null, and
`previewUrl` is now **always** null.

**Cause.** `listCreaturesForCustomer` in `src/lib/account/creatures.ts` (lines 93, 118, 132)
reads `artworks.previewKey`. That column was written by the old pre-payment preview path.
Since generation moved after payment, `src/lib/artwork-drawing.ts` writes `frontKey` and
`backKey` (lines 139 to 155) and **nothing writes `previewKey` any more.** The account page
is therefore asking for a key that is never set.

**Fix.** Read `frontKey`, falling back to `previewKey` for historic rows, exactly as
`src/app/approve/[token]/page.tsx` line 62 already does:

```ts
const key = row.frontKey ?? row.previewKey;
```

Apply it in both places in that file: `listCreaturesForCustomer` and the single-creature
read at line 217 onward. Select `artworks.frontKey` alongside `previewKey` in both queries.

**Two things to be careful of.**

- The front plate is a **transparent PNG**. On a light card it will look like floating ink
  with no garment behind it. Check how it renders and, if it reads as broken, put it on a
  tinted card rather than reaching for the back plate — the front is the one with a face on
  it and a colour portrait.
- `styleLabel` still resolves through `ART_STYLE_LABELS[style]`, and style is null on every
  new artwork since the house style landed. The fallback `"Your portrait"` is already there
  and is fine. Leave the column alone; that is a migration this change does not need.

**Verify:** the existing order `F0379EB0` must show its artwork in My Creatures without any
regeneration.

---

## 2b. The cart thumbnail is a broken image · same era, different fix

Owner screenshot, 5 August: the cart line shows the browser's broken-image icon and the raw
alt text, `Your portrait for the The Kindred Hoodie`.

**Cause.** `src/components/cart/CartView.tsx` line 103 points at
`/api/artwork/{id}/preview`. That route (`src/app/api/artwork/[id]/preview/route.ts` line 42)
returns 404 when `previewKey` is null, and `previewKey` is now never written — the same dead
column as section 2.

**But the fix is NOT the same as section 2.** In My Creatures the artwork genuinely exists
and the wrong column is being read. In the cart, **the portrait does not exist yet and by
design never will at that point**: generation happens after payment. This route is a leftover
from when portraits were drawn in the browser before checkout. It is asking for a picture we
deliberately have not made.

**Fix.** Show the garment, in the colourway they chose. The cart line already carries
`productSlug` and `color` (`src/lib/cart-store.ts` lines 21 to 24), and
`garmentImageUrl(slug, color, "front")` in `src/lib/garments.ts` already returns the
photograph. Honest, no new machinery, and it shows them what they are buying.

- Replace the `<img>` src with the garment photograph. `next/image` is fine here: it is a
  static asset, not a redirect, which is the only reason the plain `img` was used.
- **Delete `src/app/api/artwork/[id]/preview/route.ts`.** `CartView` is its only caller
  (`CartView.test.tsx` line 52 is the only other reference). Say in the commit that it died
  with pre-payment generation.
- Update `CartView.test.tsx` line 52 to assert the garment image instead.

**And fix the alt text while you are there.** It reads `Your portrait for the ${name}` where
name is already `The Kindred Hoodie`, so it renders "for the The Kindred Hoodie". The
double article is only visible because the image is broken, but it is what a screen reader
has been reading out all along. It is a garment photo now, so the alt text should describe
that: `${name} in ${item.color}`.

---

## 3. The plate · six changes

All of these are in `src/lib/print/plate.ts` unless said otherwise. Update
`docs/spec-print-layout.md` in the same commit: it is the file that will be read next time
and it currently describes the old table.

### 3a. The front wordmark is too light

`src/lib/print/fonts.ts` maps `wordmark` to `Archivo-Light.ttf` and both sides use it. The
back wordmark is large and the light weight is right there. The front is small, and at
small sizes with wide letterspacing it disappears.

**Split the role.** Add `wordmarkFront` to `PrintFontRole` mapped to
`Archivo-SemiBold.ttf` (already vendored in `assets/fonts/`, no new file, no new licence).
`frontPlate` uses `wordmarkFront`; `backPlate` keeps `wordmark`.

If SemiBold turns out too heavy against the portrait, Medium is the next step, but that
means vendoring a fourth Archivo file plus its OFL — do not do it speculatively.

### 3b. The animal's name on the front must be ALL CAPS

`frontPlate` reads:

```ts
const name = profile.name?.trim() ?? "";
```

No `.toUpperCase()`. The back already does it (`profile.name?.trim().toUpperCase()`).

`docs/spec-print-layout.md` line 38 **already specifies ALL CAPS on the front** — the owner
made this decision on 3 August and the code never followed. This is closing a gap, not a new
decision. Fix the code and remove the stale "Sentence case, and deliberately so" comment on
the `frontName` role in `fonts.ts`, and the "Serif, sentence case" row in section 4 of the
print-layout spec.

Watch the width: `FRANCIS` is meaningfully wider than `Francis` and the front name is not
currently run through `fitToWidth`. Give it the same shrink-to-fit treatment the back
heading gets, or a long name will run off a 110mm print.

### 3c. Temperament moves out of the table and under the portrait

Currently a `TEMPERAMENT` row in `tableRows`. It goes where the owner put it: **directly
under the portrait, above the lower rule**, centred, joined with a middot.

```
                 [ portrait, graphite ]

           Confident · Affectionate · Spirited

        ─────────────────────────────────
```

- Remove the temperament block from `tableRows` entirely.
- In `backPlate`, the traits line is part of the **bottom block measured upward**, sitting
  above the rule that is drawn at the end. Subtract its height from `footY` before that
  rule is placed, so the portrait rect shrinks by exactly the space the line takes and
  nothing overlaps.
- No traits chosen means **no line and no gap.** The rule moves up. Same discipline as the
  name and the year.
- Set it in the `value` role at roughly the table row size. It is a caption, not a heading:
  it must not compete with the breed name at the top.

### 3d. The table is three rows: ORIGIN, GROUP, TOGETHER

Owner: anything more is too busy. `tableRows` currently emits up to five.

| Keep | Drop |
|---|---|
| `ORIGIN` | `BREED` |
| `GROUP` | `TEMPERAMENT` (moved, see 3c) |
| `TOGETHER` | |

**`BREED` goes because it is already printed**, in caps, directly above the portrait, as the
plate's heading. Printing it twice on a plate this spare reads as a fault.

**`TOGETHER SINCE` becomes `TOGETHER`.** The owner's wording. Section 3 of
`docs/spec-print-layout.md` forbids `EST.`, `BORN` and `LIFE` and the reason still holds:
whatever the label is, it must not read as a lifespan. `TOGETHER` is safe and is the shorter
label.

Three consequences to handle rather than discover:

1. **`One of One` currently reaches the plate only through the `BREED` row.** With that row
   gone, an unrecorded animal must show `One of One` as the **heading above the portrait** —
   which `breedRowValue()` already returns, and the heading already calls it, so check this
   works rather than assuming it.
2. **The `species === "other"` branch** pushes `SPECIES`, `BREED` and `ORIGIN`. Reduce it to
   `SPECIES` and `ORIGIN` for consistency, and let the customer's own breed word be the
   heading where the heading is currently `COMPANION PROFILE`.
3. **The typed-their-own-breed branch** pushes only a `BREED` row. With `BREED` gone that
   branch produces an empty table. Their word becomes the heading; the table closes up to
   whatever remains, possibly nothing. **A plate with an empty table must still look
   deliberate** — the rule above it and the name below it carry it. Render it and look at
   it before calling this done.

### 3e. Update the spec

`docs/spec-print-layout.md` section 2 has the old five-row table and the old ASCII sketch.
Rewrite both. Note the date and that it is an owner decision, in the style the rest of that
file uses.

---

## 4. Temperament: one, two or three · not exactly three

Owner: the customer picks **at least one, up to three.**

- `src/lib/companion.ts` line 56: `TEMPERAMENT_COUNT = 3` becomes a maximum, not an
  equality. Rename it `TEMPERAMENT_MAX` so nothing can read it as a required count, and add
  `TEMPERAMENT_MIN = 1`.
- Line 134: the validation `length !== TEMPERAMENT_COUNT` becomes `length < 1 || length > 3`.
  The message becomes something like `Choose at least one word.`
- `src/components/products/ProfileQuestions.tsx` line 122 already caps at the maximum. It
  keeps working; just point it at the renamed constant.
- `src/lib/companion-copy.ts` line 56: `afterTemperament` returns `null` when
  `words.length < 3`, so a customer who picks one word gets silence where everyone else gets
  a warm line. **Make the phrase builder work for one and two words** — one word needs no
  "and", two words need `X and Y`, three keep the current comma form. The matching rules
  below it already use `has()` and work unchanged on a shorter set.
- `src/components/products/CompanionForm.tsx` is dead code (nothing imports it but its own
  test). **Delete both**, and say so in the commit. Leaving a second, stale copy of this form
  is how the wrong one gets edited in three weeks' time.

---

## 5. One of One by colour, not by size

`src/lib/breeds.ts` lines 161 to 163 and 183. Replace the size variants with colour.

| Remove | Add |
|---|---|
| `one-of-one-dog-small` | `one-of-one-dog-brown` |
| `one-of-one-dog-medium` | `one-of-one-dog-black` |
| `one-of-one-dog-large` | `one-of-one-dog-white` |
| | `one-of-one-dog-brindle` |
| | `one-of-one-dog-spotty` |

Five for dogs, and the **same five for cats**, replacing the single `one-of-one-cat`.

Display names: `One of One · Brown` and so on, matching the existing `·` form. Keep
`oneOfOne: true`, `origin: "Unrecorded"`, `group: "One of One"` and `ONE_OF_ONE_ALIASES` on
every one. `breedRowValue()` already returns `One of One` for all of them, so the plate is
unaffected and prints the same three words whichever colour was chosen.

**What the colour is actually for, and it is worth being clear about it:** it selects which
stock reference illustration the back portrait is given. It is not printed anywhere. The
owner's framing is the one to use in the interface copy — *the illustration is only an
example; the drawing is still made from your own dog.* Say that where the customer chooses,
in one line, not a paragraph.

`referenceKey()` returns null for `oneOfOne` breeds today, so these will still generate from
the photograph alone until the reference library exists. That is correct and should not be
faked.

---

## 6. Let the customer choose not to upload a photo

**Read this section before starting it. It is the only item on the list that is not
straightforward, and it can be got badly wrong.**

The ask: a customer can order without a photo, using our stock illustration for their breed.

Three obstacles, in order of severity:

1. **`artworks.upload_key` is `NOT NULL`** (`src/lib/db/schema.ts` line 29). This is a
   migration, not a form change.
2. **The reference illustration library does not exist.** Every stock illustration is
   currently a hatched placeholder. `docs/flow-review-2.md` already flags the disclosure line
   as possibly dishonest for exactly this reason. Selling a "stock illustration of your
   breed" that is a hatch pattern is a refund.
3. **The likeness is the product.** `SUBJECT` in `prompts.ts` exists entirely to stop the
   model drawing a handsome generic example of the breed. This option asks for precisely
   that, on purpose, at R999.

**So build it in two halves and ship only the first half now.**

**Half one, this pass:** make the photo genuinely optional in the data model and the
pipeline. `uploadKey` nullable; the drawing path in `src/lib/artwork-drawing.ts` handles a
null upload by drawing from the reference alone; `prompts.ts` gets **no new wording from
you** — flag to the owner that a reference-only generation needs a `SUBJECT` clause that
does not refer to a photograph, and let him write it. Do not surface the option in the
interface yet.

**Half two, gated:** the option appears in `Customizer` **only for a breed whose reference
illustration actually exists**, checked by bytes, the same way `REFERENCE` is gated in the
prompt (`docs/spec-portrait-prompting.md` section 6a). No library, no option. When it does
appear, the copy must be plain about what they are getting: an illustration of the breed,
not of their animal, and cheaper than nothing to be honest about.

**Do not ship half two in this pass.** Note in the commit that it is waiting on the library.

---

## 7. Every default colourway is White

`src/components/products/ProductFlow.tsx` line 36 returns `product.variants[0]`, so the
first variant in the array is the default.

In `src/lib/products.ts`:

- **Hoodie** — `Blue` is first. Move `White` to the front of the array.
- **Tee** — `White` is already first. No change.
- **Crewneck** — `White` is already first. No change.

So this is a one-line move, but check `src/components/products/ReorderFlow.tsx` lines 42 to
49, which also index `variants[0]`, and any test that asserts a starting colour.

**One trap.** `photoAspect()` is **per colourway, not per product** (`src/lib/garments.ts`,
the note above `PLACEMENT`), because the shoot was not consistent. Changing the hoodie's
default changes the shape of the preview box the whole profile flow renders into. Look at
the White hoodie preview at desktop and at mobile before calling this done: if the White
shot is a different ratio to Blue, the box changes size and the mobile layout has to still
hold.

The other half of this: `docs/flow-review-2.md` asks *"which colourway is the default during
the profile questions?"* and this answers it. Record the answer there and close the
question.

---

## 8. Remove the icons from How It Works on mobile

`src/components/sections/HowItWorks.tsx`. Owner: with the icon present the numbers no longer
line up and the row reads as mismatched.

The icon sits in a 40px square to the left of a column containing the number, the title and
the body. On a narrow screen that leaves the text no room and pushes the number out of
alignment with the ones above and below it.

**Drop the icon on mobile, keep it from `sm:` up.** The number takes its place as the thing
the eye lands on, which is what the owner is describing when he says the numbers no longer
align.

The `stepIcon` map stays, and so do the three imports; only the rendering is conditional.
If the icons look better gone at every width once you can see it, say so — but the ask was
mobile, so do mobile.

While you are in there: the number carries `aria-hidden="true"`, so a screen reader gets
three untitled steps in a row. Not what the owner asked for and not worth a separate commit;
fix it in passing.

---

## 9. A zoomed front view

Owner: the front preview should show roughly **a quarter of the garment, zoomed in**, with
the ability to zoom back out to the whole thing.

`src/components/products/LivePreview.tsx`, `GarmentView`. Today the box is the photograph's
own aspect ratio with the image at `object-cover` and the plate positioned as a percentage
of the photograph (`PLACEMENT` in `src/lib/garments.ts`).

The front print is 110 × 150mm on a garment roughly 600mm wide. At full-garment zoom the
plate is a smudge, and the customer has just spent five questions building it.

**The constraint that governs the implementation:** the plate is positioned as a percentage
of the photograph, so **anything that scales the photograph must scale the plate by the same
transform, from the same origin.** Scaling the image and leaving the plate behind puts the
portrait on the sleeve. The safe shape is a single wrapper holding both, transformed as one:

```tsx
<div style={{ transform: `scale(${zoom})`, transformOrigin: `${ox}% ${oy}%` }}>
  {/* garment image AND plate, unchanged */}
</div>
```

with the outer box `overflow-hidden`, which it already is.

- Zoomed in: scale so the front print area fills a comfortable share of the box, centred on
  `PLACEMENT.front`. Roughly a quarter of the garment, per the owner. Derive the number
  rather than hard-coding a magic scale, so it survives a change to the placement.
- **Default the front to zoomed in.** That is the view worth seeing.
- One quiet control to go back to the whole garment. A small button over the corner of the
  preview, not a slider — two states, not a continuum.
- **The back does not zoom.** The back plate is large and the whole point of it is the whole
  plate. Front only.
- Mobile: the preview already sits in a fixed share of the viewport
  (`docs/flow-review-2.md` bug 3). The zoom must live inside that box and must not change
  its height, or it reopens the worst bug this project has had.

---

## 10. Housekeeping

`git status` shows uncommitted work. `XNEELO_INTEGRATION.md` is deleted and
`docs/flow-review-2.md` and `docs/spec-print-layout.md` are modified. Commit those before
starting, so this pass has a clean base and the owner can see what changed.

The untracked files are the owner's own working documents and the stock images folder —
**do not commit `Stock Images/`, the `.docx` files, the `.xlsx` or
`.claude/settings.local.json`.** If they are not already in `.gitignore`, add them.

---

## 11. Not in this pass

- **`src/lib/images/prompts.ts`.** The owner is revising the animal-type wording himself.
  Any change to that file collides with his edit. If a section above seems to require prompt
  wording, say so in the commit and leave the words to him.
- The reference illustration library.
- The dark-colourway light-ink plate.

---

## 12. Verify

```
npm run build
npx vitest run
npm run lint
grep -rn "—\|–" src --include=*.tsx --include=*.ts
grep -rni "mixed breed" src | grep -v grep-exempt
grep -rn "off to be printed\|on its way to print" src
```

The `grep -v` narrows the check to printed and displayed strings, which is what the rule
was always about. Reasoning in section 13; the exempt alias carries the marker and a
comment beside it.

By hand, and none of these can be checked by reading code:

1. Render a back plate with **one** trait and with **three**. The line centres, the rule sits
   the same distance below it, and the portrait does not overlap either.
2. Render a back plate with **no** traits and **no** year. Table is one or two rows, closes
   up, still looks deliberate.
3. Render a front plate with a long name — `BARTHOLOMEW` — at 110mm. It fits.
4. Front wordmark at true print size: legible, and heavier than the back's without looking
   like a different brand.
5. The zoomed front preview: switch colourway while zoomed. The plate must stay exactly on
   the chest.
6. Open My Creatures as the customer on order `F0379EB0`. The artwork is there.
7. Read the order page at `paid` and the confirmation email, out loud, as someone who has
   just spent R999. Nothing in either says the garment is being printed.

---

## 13. Answers to the two questions that came back

### The "mixed breed" grep

`grep -rni "mixed breed"` returns `src/lib/breeds.ts:97`, inside `ONE_OF_ONE_ALIASES`.

**The alias stays. The verify step is what was wrong.** The rule in
`docs/spec-print-layout.md` section 3 is about what we **print and display** — a customer
must never be shown that phrase, because of what it carries in a South African context. It
was never about what we **listen for**. A rescue owner who types the words they have always
used has to find their dog, and an empty result is a lost sale and a small insult.

So the alias is the rule working, not breaking. Narrow the check to the thing it actually
guards:

```
grep -rni "mixed breed" src | grep -v grep-exempt
```

**Built 6 August, and not quite as sketched above.** The `grep -v ONE_OF_ONE_ALIASES` form
in the original answer cannot work: grep is line-based, and the line that matches is
`"mixed breed",` on its own, which does not contain the array's name. Splitting the check
into a `.tsx` pass and a `src/lib` pass also leaves `src/app/**/*.ts` unchecked, and
`llms.txt/route.ts` is customer-facing copy that lives there.

So the exemption is marked at the line instead: the alias carries a trailing `grep-exempt`
comment and three lines above it saying why it must not be deleted. One grep now covers
every file in `src`, and only the marked line is exempt.

The verify blocks in `docs/spec-print-layout.md` section 7, this file's section 12 and
`docs/spec-pipeline.md` section 13 all carry the narrowed command.

### The reference-only `SUBJECT` clause

Owner's, and it is waiting on him, correctly. Nothing should be written into `prompts.ts` by
anyone else while he has that file open.

The shape of what is needed, so it is not rediscovered: with no photograph, `SUBJECT`'s
first sentence ("A portrait of THIS SPECIFIC animal from the photograph") has no referent,
and the whole clause exists to stop the model drawing a handsome generic example of the
breed. On this path a handsome generic example of the breed **is what was ordered**. So it
is not a smaller version of the same instruction, it is close to its inverse, and it wants
its own named constant rather than a conditional inside the existing one.

It cannot ship before the reference library exists in any case.
