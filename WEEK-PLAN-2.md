# Week plan · Monday 3 August 2026

Owner review of the live site, plus what carried over from last week.

**Reality check first.** Two commits landed since Thursday: the one-question flow with the
mobile fix, and a plate overflow fix. Everything else from last week is still open, so the
list below is longer than the ten items reviewed this morning.

---

## Priority 0 · The live preview silently stops updating · FOUND 3 AUGUST

**Reproduced on the live site. This is ahead of everything else: the preview is what the
whole flow is built around, and it appears broken to every visitor the moment they choose
a breed.**

### What happens

Enter a name, and it appears on the plate. Choose a breed, and the plate never changes
again. Not the breed, not the binomial, not temperament, not the year. The plate keeps
showing whatever was last rendered successfully, which is the name and nothing else.

The customer sees `COMPANION PROFILE` and an empty table on a finished profile.

### Why

`previewPlates` in `src/app/products/[slug]/actions.ts` fetches the breed's stock
illustration:

```ts
const bytes = await getStorage().getBytes(stockKey(breed));
```

The illustration does not exist yet: the 113-image library has not been drawn. The Vercel
Blob adapter's `getBytes` calls `blob.head(key)`, **which throws on a missing key** rather
than returning null. There is no try/catch. So the action rejects, `setResult` is never
called in `LivePreview`, and the stale plate stays on screen. Every later render throws
too, so nothing after the breed ever appears.

### The two fixes

1. **`getBytes` must honour its own signature.** It returns `Promise<Uint8Array | null>`.
   Catch a missing blob and return null. The local adapter already does; the Blob adapter
   does not, which is why this works perfectly in development and fails only in production.
2. **`previewPlates` must never let a missing illustration break the plate.** The plate is
   typeset text. It does not need the picture. Wrap the lookup, fall back to `stockUrl:
   null`, and render regardless.

### Why this keeps happening

Third time this shape of bug has landed: local adapter tolerant, Blob adapter strict,
difference invisible until production. Worth a test that runs the Blob adapter's contract
against a missing key.

---

## Priority 1 · The site currently describes a product that no longer exists

**This is the only group where a customer could be actively misled today, and it is the
cheapest to fix. It goes first.**

| Item | Where |
|---|---|
| How It Works still says three chances to view and create | Home and `/how-it-works` |
| How It Works also outdated on the shop page | `/shop` |
| Good to Know describes the old ordering model | Shop page and elsewhere |

The product changed fundamentally on 30 July: nothing is drawn before payment, and there is
no live regeneration. Every surface describing the old flow is now wrong.

**The replacement, in three beats:**

1. Tell us about them, and see it on the garment
2. Order, and we draw them by hand
3. Approve it before anything is printed

The promise that survives all of this, and should be said plainly: **nothing is printed
until you say yes.** That was always the trust line and it is still exactly true.

**Also carried from last week and still wrong:** delivery copy, `Cape Town`, and the
Jeffreys Bay change. Verify those greps still pass while in here.

---

## Priority 2 · One art style · this removes work, so do it early

Owner decision: no portrait, watercolour or line sketch choice. **One house style.**

Deleting the choice cascades usefully:

- `StylePicker`, `ArtStyle` selection and the paw-print placeholders go
- The three style example images are no longer needed
- `docs/spec-portrait-prompting.md` collapses to two prompts, front and back
- One less decision in the customer's path

Keep `ArtStyle` in the data layer if it is load-bearing for stored artwork, but remove it
from the interface entirely. **Do this before anything else builds on top of styles.**

---

## Priority 3 · Make the site look like a shop

Carried from last week, unstarted, and the highest visual return per hour of work.

**`src/lib/products.ts` is untouched.** It still has Stone, Charcoal, Olive and Ecru,
placeholder prices, one shared size list and no fit.

| | Now | Should be |
|---|---|---|
| Hoodie, unisex | Stone/Charcoal/Olive · R899 | Blue · Lilac · White · **R999** |
| Crewneck, women's | R749, XS to XXL | White · Peach · Grey · Olive · **R799**, XS to **XL** |
| Tee | R449 | White · Olive · Heritage Blue · **R599** |

**And the 33 garment photographs are still not wired.** They were imported to
`public/garments/` on Thursday and nothing references them, so every preview is a hatched
grey box. `docs/spec-garment-mockups.md` covers it.

These two together are what turns a wireframe into a shop.

---

## Priority 4 · The breed picker

**Done already, in `src/lib/breeds.ts`:** searching `pavement special`, `brak`, `street
dog`, `mutt`, `stray`, `rescue`, `SPCA` or `mixed` now lands on One of One. `africanis`
still correctly finds the actual breed.

**Still to build:**

`Can't find them?` is greyed out until the customer types, and then only says `Thanks for
letting us know`. Two problems: it hides the escape hatch from the people most likely to
need it, and it collects data for us while giving the customer nothing.

**It must be visible from the start, and it must resolve their problem.**

Proposed: they type the breed in their own words. We then

1. show it on the plate immediately, as typed
2. log it to `breed_requests` for the list to grow from
3. say something that closes the loop rather than thanking them for the data

The plate simply omits ORIGIN and GROUP, which it already does cleanly.

**Owner decision needed:** print their typed text as the breed, or route them to One of One
and keep the typed text only as a signal? Printing what they typed is far more satisfying
and every job sheet is reviewed before printing, so a typo is catchable. It is also how a
name gets misspelled onto a garment.

---

## Priority 5 · Plate typography

**Unblocked 3 August.** Measurements received and written into
`docs/spec-print-layout.md` section 1.

Front print is 150mm tall by 110mm wide, in three stacked bands: arc 25 percent, portrait
60 percent, name 15 percent. Placed centred on the left chest with the top 80 to 90mm
below the shoulder seam. The name is now all caps, and the spec records that this
overrides the earlier sentence-case reasoning.

**One structural consequence:** `products.ts` has a single `printArea` of 280 by 350mm,
which is the back. The front is a different size and needs its own entry. Fold this into
the `products.ts` work in Priority 3 rather than doing it twice.

---

## Priority 6 · The revision form

`Something is not quite right` currently walks the customer through fields one at a time.
On a revision that is wrong: they already know what they want to change, and making them
step through everything to reach it is friction applied to someone already disappointed.

**One page, every field visible, change what you like, submit.**

The one-question-at-a-time pattern is for a first-time flow where each answer is a small
reward. A revision is a correction, and corrections want everything on screen.

---

## Priority 7 · Order without uploading a photo

New product decision, and it needs thinking through before it is built.

The customer orders the plate using our breed illustration rather than their own animal.
Cheaper to fulfil, no generation, no approval loop, and it opens the range to people who do
not have a good photograph.

**Open questions:**

- Is it cheaper? It costs less to make and it is a different thing to own.
- Does it still go through approval, or ship straight to print?
- What does the plate say? Their pet's name against a breed illustration is the obvious
  answer, but it is worth being sure that reads as charming rather than as a shortcut.
- Does it need its own name in the range, so it never looks like the personalised version
  gone wrong?

---

## Priority 8 · More designs · plan, do not build this week

The largest change on the list. Designs become a first-class concept, and not every design
is the companion profile plate.

That touches the product model, the print pipeline, the preview, the admin queue and the
questions asked, since a different design needs different inputs. It deserves a proper
architecture rather than being wedged into the plate.

**This week:** decide what the second design actually is, and what it asks the customer.
Nothing more.

---

## What is needed from the owner

1. The plate sizing from the original mockup
2. A decision on the typed-breed question in Priority 4
3. A decision on whether the no-photo version is a separate product and price
4. What "characteristics on the current design are not showing" means on the shop page ·
   this could not be identified from the code and needs a screenshot or a walkthrough
5. Still outstanding from last week: the 113 breed illustrations, and the print-resolution
   question for Red Hot Prints

---

## Handover order to Claude Code

1. Trust copy · Priority 1
2. Remove the style choice · Priority 2
3. `products.ts` and the garment mockups · Priority 3
4. Breed picker · Priority 4
5. Revision form · Priority 6

Priorities 5, 7 and 8 wait on owner decisions.
