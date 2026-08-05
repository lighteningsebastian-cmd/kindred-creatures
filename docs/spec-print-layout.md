# Spec: print layout · front and back plate

**For Claude Code. This specifies the composited artwork only: what appears on the garment,
where, and in what type. The customer journey that collects this data is specified
separately. Build this first: the journey has nothing to populate until the plate exists.**

Owner decisions, 29 July 2026. Applies to hoodie, tee and crewneck. Tote is deferred.

---

## The rule that governs everything here

**The image model draws the animal. Nothing else.**

Every letter, rule and table on the garment is typeset by us and composited around a
generated portrait with a transparent background. Image models cannot render text: the
owner's own first mockup reads `KINDBED CREATURES` in two of four panels. On a printed
garment that is unrecoverable.

Compositing also means the layout is identical on every order rather than a gamble.

---

## 1. Front · left chest, small

Three elements, stacked and centred on a shared vertical axis.

```
      ⌒ K I N D R E D   C R E A T U R E S ⌒        arc, letterspaced caps
              [ portrait, colour ]                  face-on, transparent bg
                   Francis                          serif, sentence case
```

| Element | Content | Type |
|---|---|---|
| Arc | `KINDRED CREATURES` | Letterspaced caps, set on a half-circle arc above the portrait, curving upward |
| Portrait | Generated, colour, facing the viewer | Transparent background |
| Name | The pet's name, as entered | Serif, **ALL CAPS** |

### Dimensions · owner measurements, 3 August 2026

**The whole front print is 150mm tall by 110mm wide.** The three elements are stacked
bands that fill that height.

| Band | Share | Height | At 300 DPI |
|---|---|---|---|
| Arc | 25% | 37.5mm | 443px |
| Portrait | 60% | 90mm | 1063px |
| Name | 15% | 22.5mm | 266px |
| **Total** | 100% | **150mm** | **1772 × 1299px** |

**These are band heights, not type sizes.** The arc band is the vertical space the curved
text occupies including its curvature, so the cap height of the glyphs is a fraction of it.
Set the type to fill its band optically rather than matching the number: the point of the
percentages is the relationship between the three, which is what the owner is specifying.

**Placement on the garment:** centred on the left chest, with the top of the print
**80 to 90mm below the shoulder seam**. Left chest means the wearer's left, so it sits
right of centre when looking at the garment photograph.

### Notes

- The arc is a true text-on-path, curving with the top of the portrait. Do not fake it by
  rotating individual glyphs.
- **The name is all caps.** Owner decision, 3 August, overriding the earlier sentence-case
  instruction in this spec. The reasoning for sentence case was that `Francis` reads
  intimate against the archival `FRANCIS` on the back; the owner prefers the caps on both.
  Recorded so the trade is visible, not to reopen it.
- **The front needs its own print area.** `products.ts` currently carries a single
  `printArea` of 280 × 350mm, which is the back. Front is 110 × 150mm and must be separate.
- **If no name was given, omit the name band entirely** and let the arc and portrait fill
  the height. Never render an empty line or a placeholder.

---

## 2. Back · large plate

**Revised 5 August 2026, owner decision.** The table was five rows and is now three; the
temperament moved out of it and under the portrait. What changed and why is recorded under
the sketch, because both were deliberate trades rather than tidying.

```
        K I N D R E D   C R E A T U R E S
        ─────────────────────────────────

                YORKSHIRE TERRIER
               Canis lupus familiaris          italic

                 [ portrait, graphite ]        side profile, transparent bg

           Confident · Affectionate · Spirited     centred, middot joined
        ─────────────────────────────────

        ORIGIN            Yorkshire, England
        GROUP             Toy Terrier
        TOGETHER          2021

                      FRANCIS
                      KC-01248
```

### Element by element

| Element | Content | Notes |
|---|---|---|
| Header | `KINDRED CREATURES` | Widest letterspacing on the plate |
| Rule | Solid, full plate width | Directly beneath the header |
| Breed name | From the breed table | Caps. **The only place the breed is printed** |
| Binomial | From the breed table | Italic, sentence case, e.g. `Canis lupus familiaris` |
| Portrait | Generated, graphite, side profile | Transparent background |
| Temperament | One to three chips, joined ` · ` | Centred, directly under the portrait |
| Rule | Solid, full plate width | Beneath the temperament |
| Data table | Label left, value right | See below |
| Name | The pet's name | **Caps**, centred |
| Reference | `KC-XXXXX` | Small caps or small letterspaced, beneath the name |

### The heading is the only place the breed appears

Whatever the customer told us their animal is arrives at the heading above the portrait, in
caps, and nowhere else. There are four routes in and all four end here:

| What we were told | Heading |
|---|---|
| A breed from our table | The breed name, e.g. `YORKSHIRE TERRIER` |
| An unrecorded breed | `ONE OF ONE` |
| A breed they typed, because our list did not have it | Their words, as typed |
| An "other" species' own word for their animal | Their words, as typed |
| No breed word at all | `COMPANION PROFILE` |

The last row is a real state, not a fallback nobody hits: an "other" species customer must
name the KIND of animal and may leave the breed blank. The `SPECIES` row carries the answer
in that case.

### The data table

Label column left aligned, value column right aligned, aligned to the plate edges. **Three
rows at most**, in this fixed order:

| Label | Source |
|---|---|
| `ORIGIN` | Breed table, or the customer's own answer for an "other" species |
| `GROUP` | Breed table. `COAT` for cats, `NATIVE TO` for birds, per species |
| `TOGETHER` | Year, optional |

For an "other" species the rows are `SPECIES` and `ORIGIN`, plus `TOGETHER`.

**Rows with no value are omitted entirely, not printed empty.** The table closes up, and it
is allowed to come back **completely empty**: a customer who typed their own breed and gave
no year has their word in the heading and nothing left for a row. A plate with an empty
table must still look deliberate, and it does, because the rule above it and the name below
it carry it.

### Why BREED and TEMPERAMENT left the table · owner, 5 August

**`BREED` goes because it is already printed, in caps, directly above the portrait, as the
plate's heading.** On a plate this spare, printing the same words twice reads as a fault
rather than a fact.

The consequence to keep in mind: `One of One` used to reach the plate only through the
`BREED` row. It now reaches it as the heading, which is the correct place for it — it reads
as status rather than absence there, exactly as section 3 intends.

**`TEMPERAMENT` goes because it is not really a data row.** Under a label, in a right
aligned column, three personality words read as a specification. Centred under the portrait
they read as a caption on it, which is what they are.

It is set in the table's VALUE face at roughly the row size. **It is a caption, not a
heading: it must not compete with the breed name at the top.**

**One to three words, not exactly three** (see `src/lib/companion.ts`). The line is measured
upward from the rule like everything else in the bottom block, so:

- Three words and one word cost the portrait exactly the same height. Only the line's
  WIDTH changes, and it stays centred.
- No words means **no line and no gap**. The portrait grows back into the space. This is
  the same discipline the name and the year already keep: nothing on this plate leaves a
  hole where a thing would have been.

### `TOGETHER SINCE` became `TOGETHER`

The owner's wording, and the shorter label. Section 3's constraint is unchanged and still
governs: whatever this label is called it must never read as a lifespan, so `EST.`, `BORN`
and `LIFE` remain forbidden. `TOGETHER` is safe.

---

## 3. Two content decisions that are not negotiable

### "One of One" replaces "mixed breed"

Where a breed is unknown, mixed or not applicable, the `BREED` value is:

```
BREED    One of One
```

Never `Mixed Breed`, `Crossbreed`, `Mixed`, or `Unknown`, anywhere in the product, the
breed table, the UI or the database display values. Two reasons, and the first is the one
that matters:

1. In a South African context "mixed" carries racial connotations the brand must not
   invoke, even applied to an animal.
2. It is better copy. On a plate where everything else is catalogued, `One of One` reads as
   status rather than absence, and it sits correctly beside a catalogue reference number.

Store the underlying case as a `oneOfOne` flag or a breed id of `one-of-one`. Never store
or render the phrase it replaces.

### The plate must not read as a headstone

A name in centred caps with a date directly beneath it is the visual grammar of a memorial.
A meaningful share of these orders are placed within a week of a loss, so this is not a
hypothetical.

Three hard constraints:

1. **Only one date can ever appear on the plate.** One date is a founding date. Two dates
   is a lifespan, and no amount of good copy recovers from that. The schema must make a
   second date **unrepresentable**, not merely unasked: one nullable integer year, no end
   date field, ever.
2. **The date lives in the data table, never under the name.** Beneath the name sits the
   reference code and nothing else. Name above a catalogue number is archive language;
   name above a year is memorial language.
3. The label is `TOGETHER SINCE`, never `EST.`, `BORN`, or `LIFE`.

If a brand founding year is wanted, it belongs at the top with the brand name, not at the
foot with the pet's. As currently drawn, `FRANCIS / EST. 2026` says Francis was established
in 2026.

---

## 4. Typography

The repo already ships **Archivo** and **Young Serif** and the design system is
authoritative (`design/DESIGN-SYSTEM.md`). Do not introduce a fourth typeface for print.

| Use | Face |
|---|---|
| `KINDRED CREATURES`, **back** | Archivo, light weight, wide letterspacing |
| `KINDRED CREATURES`, **front** | Archivo, **semibold**, same wide letterspacing |
| Table labels, reference code | Archivo, caps, letterspaced, small |
| Table values, and the temperament line | Archivo, regular |
| Breed name | Archivo, caps |
| Binomial | A serif italic |
| Front name | Serif, **caps** |
| Back name | Serif or Archivo, caps, centred |

**The two wordmarks are two roles, not one** (`wordmarkFront` and `wordmark` in
`src/lib/print/fonts.ts`). Same words, same family, deliberately different weight. The back
header is large and Light is right for it. The front arc is a fraction of that size and
carries the same wide letterspacing, and at that size Light stops reading as restrained and
starts reading as absent: thin strokes, spread thinly, over a colour portrait. Owner, 5
August.

If SemiBold ever proves too heavy against the portrait, Medium is the next step. That means
vendoring a fourth Archivo file and its OFL, so do not reach for it speculatively: look at
the front at true print size first.

**Both names are caps.** Owner decision, 3 August. See section 1's note for the trade that
was made. The front name is shrunk to fit the plate width exactly as the back's heading is,
because caps are meaningfully wider than sentence case and the worst case (`BARTHOLOMEW` on
a 110mm print) overflows without it.

**Outline all text to paths before rasterising.** Do not rely on fonts being installed in a
serverless runtime: a missing font substitutes silently and ruins the layout, and it will
not be caught in local development where the font is present.

---

## 5. Rendering

- Compose the type layer as SVG, glyphs outlined, then composite over the generated PNG and
  rasterise to the product's `printPixels` at 300 DPI.
- Transparent background throughout. The plate prints directly onto the garment colour;
  any opaque background prints as a rectangle.
- Ink is a single dark tone. **Dark colourways such as Washed Black need a light-ink
  variant of the whole plate, type included.** Leave a seam for an inverted render; do not
  build it until the printer confirms how dark garments are handled.
- One canonical composited PNG per side, generated once. The customer preview is a
  downscaled watermarked copy of those exact bytes, and the print file is a resize of them.
  **Never regenerate at fulfilment time.** See `docs/spec-portrait-prompting.md` section 1.

---

## 6. Prompt iteration

Prompts will be revised repeatedly and by someone non-technical. Set that up now.

- Put every prompt string in **one file**, `src/lib/images/prompts.ts`, with nothing else in
  it. No prompt text anywhere else in the codebase.
- Structure it as named constants composed at the call site, so a single clause can be
  changed without touching the others.
- Add `promptVersion: text("prompt_version")` to `artworks`, written on every generation.
  When quality shifts, it must be possible to tell which prompt produced which artwork.
  Prompt work is empirical and undocumented changes get rediscovered expensively.
- Keep prompts in code rather than in the database or an admin screen. Code gives a review
  step, a diff and a revert. An admin field that pushes an untested prompt straight to
  production is a way to break the product at three in the morning.

---

## 7. Verify

```
npm run build
npx vitest run
npm run lint
grep -rn "—\|–" src --include=*.tsx --include=*.ts
grep -rni "mixed breed" src                        # must be empty
```

Sample plates for every case below are written by `src/lib/print/sample.test.ts`, which is
off by default because the rest of the suite has no business writing files:

```
RENDER_PLATES=1 npx vitest run src/lib/print/sample.test.ts
```

Manual, at 100 percent zoom on a rendered print file:

- Every letter is correct and sharp. This check is the entire reason compositing exists.
- The arc curves smoothly and the glyphs sit on the path, not rotated individually.
- Transparency is real: open over a dark background and confirm alpha, not white pixels.
- Omit the name, and the front is still centred and deliberate.
- A breed with a long name and a long origin does not overflow or collide with the value
  column.
- `ONE OF ONE` renders as the HEADING for an unknown breed, and the breed appears nowhere
  else on the plate.
- **One trait and three.** The line centres, the rule sits the same distance below it, and
  the portrait does not overlap either.
- **No traits and no year.** The table is one or two rows, it closes up, and the plate still
  looks deliberate.
- **An empty table**, from a typed breed with no year. The heading and the name carry it.
- **A long name on the front**, `BARTHOLOMEW` at 110mm. It fits.
- **The front wordmark at true print size.** Legible, and heavier than the back's without
  looking like a different brand.
