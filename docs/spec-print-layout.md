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

```
        K I N D R E D   C R E A T U R E S
        ─────────────────────────────────

                YORKSHIRE TERRIER
               Canis lupus familiaris          italic

                 [ portrait, graphite ]        side profile, transparent bg

        ─────────────────────────────────

        BREED             Yorkshire Terrier
        ORIGIN            Yorkshire, England
        GROUP             Toy Terrier
        TEMPERAMENT       Confident · Affectionate · Spirited
        TOGETHER SINCE    2021

                      FRANCIS
                      KC-01248
```

### Element by element

| Element | Content | Notes |
|---|---|---|
| Header | `KINDRED CREATURES` | Widest letterspacing on the plate |
| Rule | Solid, full plate width | Directly beneath the header |
| Breed name | From the breed table | Caps |
| Binomial | From the breed table | Italic, sentence case, e.g. `Canis lupus familiaris` |
| Portrait | Generated, graphite, side profile | Transparent background |
| Rule | Solid, full plate width | Beneath the portrait |
| Data table | Label left, value right | See below |
| Name | The pet's name | **Caps**, centred |
| Reference | `KC-XXXXX` | Small caps or small letterspaced, beneath the name |

### The data table

Label column left aligned, value column right aligned, aligned to the plate edges. Rows in
this fixed order:

| Label | Source |
|---|---|
| `BREED` | Breed table, or `One of One` |
| `ORIGIN` | Breed table |
| `GROUP` | Breed table |
| `TEMPERAMENT` | Three chips chosen by the customer, joined with a middot |
| `TOGETHER SINCE` | Year, optional |

**Rows with no value are omitted entirely, not printed empty.** The table closes up. A
plate with four rows must look as deliberate as one with five.

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
| `KINDRED CREATURES`, both sides | Archivo, light weight, wide letterspacing |
| Table labels, reference code | Archivo, caps, letterspaced, small |
| Table values | Archivo, regular |
| Breed name | Archivo, caps |
| Binomial | A serif italic |
| Front name | Serif, sentence case |
| Back name | Serif or Archivo, caps, centred |

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

Manual, at 100 percent zoom on a rendered print file:

- Every letter is correct and sharp. This check is the entire reason compositing exists.
- The arc curves smoothly and the glyphs sit on the path, not rotated individually.
- Transparency is real: open over a dark background and confirm alpha, not white pixels.
- Omit the name, and the front is still centred and deliberate.
- Omit the year and the temperament, and the table closes up cleanly.
- A breed with a long name and a long origin does not overflow or collide with the value
  column.
- `One of One` renders in the `BREED` row for an unknown breed.
