# Flow review · owner walkthrough, 30 July 2026

Second review of the live profile flow. What is working, what is broken, and the open
questions for the next session.

---

## Working

- `Introduce us to your best friend` reads right.
- Chip colours now on brand. Design system violation resolved.
- Breed search ranking behaves: typing `ger` finds German Shepherd.

---

## Bugs, in order of severity

### 1. The breed picker never shows what was selected

Selecting German Shepherd leaves the field reading `Start typing`. The customer cannot
tell whether their choice registered. This is the worst of the set: it makes a working
feature look broken.

**Expected:** on select, the input shows the chosen breed name, the results list closes,
and a clear affordance exists to change it.

### 2. Plate placement · FIXED, verified 3 August

The header sits clear of the hood on the live site. Closed, do not reopen.

### 3. On mobile the form is unusable · worst bug in the set

The sticky garment occupies nearly the whole viewport and the form sits **behind and below
it**. The customer can see a sliver, barely two lines of text, and scrolling does not bring
the rest into view: the garment holds its position until the form is finished, then
releases and scrolls away.

So the customer answers questions they cannot read, and the reward they were promised only
appears once there is nothing left to reward.

This is not a sticky-offset tweak. The layout is wrong. On mobile:

- The preview takes a **fixed share of the viewport at the top**, roughly 40vh, and stays
  there for the entire flow.
- The form occupies the **remaining space below it**, never behind it, and is fully
  readable and scrollable within that space.
- Neither element ever occludes the other. If a keyboard opens, the preview shrinks; it
  does not cover the field being typed into.

One question at a time is what makes this fit. Six stacked fields cannot live in 60vh; one
question comfortably can.

### 4. Remove the "Most common" shortlist

Owner decision, reversing my earlier suggestion. The breed field shows **nothing** until
the customer types. Results drop down as they type, and the `Can't find them?` link sits
permanently beneath the field.

Keep `popularBreeds()` in `src/lib/breeds.ts`, it is harmless, but the picker no longer
calls it for the empty state.

### 5. The stock-illustration line

Currently: `The illustration shown is a German Shepherd example.`

Owner flagged it. Two possible readings, to confirm in the next session: the wording is
wrong, or the line is dishonest while the illustration is still a hatched placeholder
rather than an actual German Shepherd. If the latter, the line should not render until the
breed library exists.

---

## TEMPERAMENT · keep, and give it a second job

Owner: *"I think we can keep it, but we need to rationalise it. What do we use those
options for?"*

**Job one, already true: it is printed.** It fills a row on the back plate.

```
TEMPERAMENT    Confident · Affectionate · Spirited
```

Without it the plate is BREED, ORIGIN, GROUP and a year: a specification sheet. Temperament
is the only line on the garment that came from the owner rather than from a lookup table.
That alone justifies it, but only if the customer *sees* it land on the plate as they
choose, which the live preview now makes possible.

**Job two, new: the flow answers back.** The owner's own idea, and it is the thing that
makes the question feel like a conversation rather than a form.

After the chips are chosen, the flow responds using the words they picked:

> `Confident, affectionate and spirited. They sound like a good one.`

Vary by what was chosen, warmly and briefly. Sleepy and gentle earns a different line to
fearless and mischievous. Never generic praise: it must obviously read what they said.

**Constraint:** these lines are written by us and selected by rule from the chip
combination. They are **not** generated, and the chips are **not** sent to any model. See
`docs/spec-pipeline.md` section 6.

**Do not** let temperament influence the artwork. That was considered and dropped when the
product became a companion profile. The plate is where these words live.

---

## The redesign: one question at a time

Owner decisions, 30 July.

### Order · corrected 30 July, this reverses my earlier draft

**The profile comes first. Colour and size come last.**

1. **The profile questions**, one at a time, under `Introduce us to your best friend`.
   Name · species · breed · temperament · year.
2. **The reveal.** The completed plate on the garment, front and back.
3. **Colour.** Now they switch colourways and watch their finished plate move across them.
4. **Size.**
5. **Their photo**, then checkout.

**Why this way round matters.** Colour and size are shopping. The profile is the
commission. Asking someone to pick a size before they have seen anything makes this a
clothing purchase with a customisation step bolted on. Asking about their dog first, and
only then what they would like it on, makes it a commission that happens to arrive as a
hoodie. Same fields, completely different product.

It also puts the colour switcher where it does the most work: they are choosing between
five versions of **their own** finished plate, not five empty garments.

**During the profile questions the preview shows a default colourway** for the product they
arrived on. Choose a mid-tone that flatters graphite, and never change it under them
mid-flow.

### The preview stays visible throughout, on every screen

This is the requirement that shapes the layout.

**Desktop:** form left, preview right, sticky for the *entire* length of the form. The
current implementation releases early, which is bug 3.

**Mobile:** the hard case, and the reason one-question-at-a-time actually helps. A single
question fits comfortably in half a phone screen, where six stacked fields do not.

```
┌──────────────────────┐
│   PREVIEW  ~40vh     │  sticky, does not scroll
│   garment + plate    │
├──────────────────────┤
│   ONE QUESTION       │  the only thing that changes
│   [ answer ]         │
│   Next               │
└──────────────────────┘
```

The preview must never leave the screen on mobile. If a keyboard opens and squeezes it,
shrink the preview rather than scroll it away: the customer needs to see their name land
on the plate as they type it.

### Progress, and the tone between questions

Owner wants warmth rather than a counter. No `3 of 6`.

Between questions the flow reacts to what was just given:

- After the name · `Getting to know {name} a little better.`
- After the breed · fill ORIGIN and GROUP on the plate visibly, and say something that
  shows we know the breed
- After temperament · the line described above

Quiet dots may indicate length. Numbers make it a form.

---

## Build order for the next session

1. **Bug 3, the mobile layout.** Nothing else can be judged until the form is readable on a
   phone. Everything below is invisible behind this one.
2. **Bug 1, the breed picker selection state.** A working feature that looks broken.
3. **The reordered one-question flow**, with the reactive copy and the dots.
4. Wire `public/garments/` so the preview shows a real garment rather than a hatched frame.

Items 1 to 3 are all in the customer's path. Item 4 is what makes any of it look like a
product.

**Superseded 3 August:** see `WEEK-PLAN-2.md` Priority 0. The live preview stops updating
entirely once a breed is chosen, which is ahead of everything on this list.

---

## Still to answer

- The stock-illustration line: wrong wording, or wrong to show it at all while the
  illustration is still a placeholder?

---

## Answered

### Which colourway is the default during the profile questions? · ANSWERED 5 August

**White, on every garment.** Owner decision.

`ProductFlow` and `ReorderFlow` both start at `product.variants[0]`, so the order of the
`variants` array in `src/lib/products.ts` IS this answer. The tee and the crewneck already
led with White; the hoodie led with Blue and has been reordered. Reordering that array is a
product decision now, not tidying, and `products.test.ts` asserts it.

It reaches further than the swatch, and this was checked rather than assumed: `photoAspect()`
is per COLOURWAY rather than per product, because the shoot was not consistent, so the
default also sets the shape of the preview box the whole profile flow renders into. All
three hoodie shots are 1120 × 1400, so the box did not move. Asserted, so a future default
cannot change it silently.

**One thing found next to it, not fixed here and not asked for.** The tee's Heritage Blue
and Olive shots are landscape while its White is portrait, so a tee customer who switches
colourway mid-flow DOES resize the preview box under themselves. `lib/garments.ts` already
records this as a known consequence of an inconsistent shoot. It wants a recrop rather than
code.

---

## Still outstanding from before

- `products.ts` untouched: old colours, old prices, no fit split
- Garment photography imported to `public/garments/` but not wired
- The 113-image library does not exist, so every illustration is a placeholder
- Style examples still paw prints
