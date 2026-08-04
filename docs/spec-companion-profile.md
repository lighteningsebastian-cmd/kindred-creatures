# Spec: the Companion Profile · product, artwork, layout and journey

**For Claude Code. This is the master build document for the redesigned product.
It supersedes `docs/spec-customer-journey.md` and section 4 of
`docs/spec-portrait-prompting.md`. Section 1 of the prompting spec, the approval bug,
still stands and should be fixed first.**

29 July 2026, from the owner's design mockups.

---

## 1. What the product now is

Not "a pet portrait on a hoodie". A **companion profile**: a specimen plate in the natural
history tradition, made for one animal.

- **Front, left chest, small.** Their pet in colour, facing the viewer. `KINDRED CREATURES`
  arched in a half circle above it, the pet's name below.
- **Back, large.** `KINDRED CREATURES` across the top with a solid rule under it, the breed
  name, the Latin binomial, a side-profile portrait in graphite, a data table, the pet's
  name and a reference code.

Two registers doing two jobs: warmth at the chest, archive across the back.

### The likeness rule, and it differs by side

| | Fidelity | Why |
|---|---|---|
| **Front** | **Faithful.** Their actual animal, refined. Coat, markings, colouring and expression must be recognisably theirs. | This is the likeness. It is what makes the garment personal. |
| **Back** | **Artistic licence.** Breed-accurate and close to their animal, not a forensic match. | A side profile has to be invented from a face-on photo. Chasing exactness here fails hardest on flat-faced breeds and delays everything. |

**The safeguard: the customer approves both sides before paying.** No copy promise manages
this expectation as well as showing them the actual artwork. Never present the back as an
exact likeness, never apologise for it either. It is a plate.

---

## 2. Decisions already made · do not relitigate

- Front colour and face-on. Back graphite and side profile. Never the same style both sides.
- Breed comes from a **searchable list we maintain**, not free text, not photo detection.
- Colourways replace Stone, Charcoal and Olive with the supplier's actual range:
  **Washed Black · Blue Shadow · Dusty Lilac · Winter White · Bush Green**
- Species templates: **Dog and Cat** share one · **Bird** one · **Reptile** one ·
  **Other** with customer-filled fields, for horses and everything else.
- Hoodie, tee and crewneck all get front and back. **Tote gets the back design only**, on
  one side.
- All prices, shipping and free-shipping threshold as previously set. Print at R70 covers
  both sides, so front and back costs nothing extra.

---

## 3. The print files are composited, not generated

**This is the most important technical decision in the spec.**

Image models cannot render text reliably. The owner's own first mockup has the front arc
reading `KINDBED CREATURES` in two of four panels. On a garment that is unrecoverable.

So: **the model draws the animal and nothing else.** Every letter, rule and table on the
garment is typeset by us and composited around the generated portrait.

### Pipeline

```
their photo
   ├─► generate FRONT portrait   colour, face-on, transparent background
   └─► generate BACK portrait    graphite, side profile, transparent background
                                 breed reference image as second input

        ▼                                  ▼
   composite into FRONT template    composite into BACK template
   (arc text + name)                (header, rule, breed, binomial,
                                     table, name, reference code)
        ▼                                  ▼
   canonical front PNG              canonical back PNG
        │                                  │
        ├── downscaled + watermarked ──────┤──► customer preview
        └── resized to printPixels ────────┴──► print file
```

### Rules that follow from it

1. **Generate each side once.** The print file is a resize of the approved canonical bytes,
   never a fresh generation. This is the approval bug from the prompting spec and it must
   not be reintroduced by the redesign.
2. **`Try another` regenerates both sides together.** Front and back must always be the
   same animal from the same session, or they stop looking like one garment.
3. **Transparent backgrounds**, `background: "transparent"`, `output_format: "png"`. A solid
   background prints as a rectangle on a coloured hoodie.
4. **Convert text to paths when rasterising.** Do not rely on system fonts being present in
   a serverless runtime. Compose the layer as SVG with glyphs outlined, then rasterise.
   A missing font on Vercel silently substitutes and ruins the layout.
5. Two generations per order, roughly R7 in API cost against a R566 landed cost. Irrelevant.

---

## 4. The back templates, by species

Common to all: `KINDRED CREATURES` header, solid rule beneath, portrait, data table, the
pet's name in caps at the foot, and a reference code.

### Dog and Cat

```
KINDRED CREATURES
────────────────────
YORKSHIRE TERRIER
Canis lupus familiaris          ← italic

        [ portrait ]

ORIGIN            Yorkshire, England
GROUP             Toy Terrier
TEMPERAMENT       Confident · Affectionate · Spirited
COMPANION SINCE   2021
────────────────────
FRANCIS
KC-01248
```

**Mixed breed variant**, using the owner's own copy, which is the best line in the set:

```
HERITAGE          Mixed Breed
KNOWN AS          One of One
COMPANION SINCE   2020
```

### Bird

```
SPECIES           Cockatiel
NATIVE TO         Australia
COMPANION SINCE   2017
```

### Reptile

```
SPECIES           Bearded Dragon
NATIVE RANGE      Australia
COMPANION SINCE   2022
```

### Other

Header reads `COMPANION PROFILE` in place of a breed name. Up to three customer-supplied
label and value pairs, each capped at 24 characters for the label and 32 for the value.
Sanitise hard: this text is printed on a garment.

---

## 5. Breed data

**`src/lib/breeds.ts`**, static data, no external API.

```ts
export interface Breed {
  id: string;              // "yorkshire-terrier"
  name: string;            // "Yorkshire Terrier"
  species: "dog" | "cat" | "bird" | "reptile";
  binomial: string;        // "Canis lupus familiaris"
  origin: string;          // "Yorkshire, England"
  group?: string;          // "Toy Terrier", dogs and cats only
  nativeTo?: string;       // birds and reptiles
  referenceKey: string;    // storage key of the profile reference image
}
```

Target roughly sixty entries covering the South African market, plus explicit
`mixed-breed-dog` and `mixed-breed-cat` entries. This is a lookup table, not AI: the
customer picks a breed and the garment comes back knowing its origin, group and binomial.
That is what makes it feel expert.

### The reference image library

One clean side-profile reference per breed, used as the second input to the back
generation so the model is not inventing the side view from nothing.

> **Narrowed 4 August 2026.** This paragraph used to say "so the model is not inventing
> skull shape and ear set from nothing", which contradicted the prompt in section 6 below
> ("only the head angle and pose from the SECOND image"). The narrow reading won: the
> reference supplies the *angle*, and every physical trait still comes from the
> photograph, because `SUBJECT` has already claimed ear shape and facial structure and a
> prompt cannot claim the same thing twice without letting the model choose. Reasoning in
> `docs/spec-portrait-prompting.md` section 6a.

- **Generate them yourself and review every one by hand.** Do not use stock photography:
  the rights are unclear and it would mean feeding someone else's image into a commercial
  pipeline.
- Store in the repo or in Blob under a stable key. They change rarely.
- Mixed breed entries have **no reference**. Generate from the photo alone and accept more
  variance. The owner's copy already earns that room: *No pedigree, no problem. Every
  companion is one of one.*

---

## 6. Prompting

Keep the three-part structure from `docs/spec-portrait-prompting.md`. Two prompts now.

### Front · colour, face-on, faithful

```
A portrait of THIS SPECIFIC animal from the photograph. Preserve its exact markings,
coat colour and pattern, ear shape, eye colour and facial structure. The likeness must
be unmistakable to its owner. Full natural colour, soft even light. Head and shoulders,
facing the viewer, centred, generous margin. No background scenery, no frame, no border,
no text, no lettering, no signature, no watermark. Transparent background.
```

### Back · graphite, side profile, breed reference

Two input images: their photograph first, the breed reference second.

```
A side-profile portrait of the animal in the FIRST image. Take its coat colour, pattern,
markings and character from the FIRST image. Take only the head angle and pose from the
SECOND image. Rendered as a detailed graphite pencil drawing, fine tonal shading, no
colour. Facing left in profile, head and upper chest, centred, generous margin.
No background scenery, no frame, no border, no text, no lettering, no signature,
no watermark. Transparent background.
```

**The failure mode to watch for** is the output drifting toward the reference animal rather
than theirs. Test with a distinctively marked dog: a patch over one eye, an unusual coat.
If the patch disappears, the reference is dominating and the prompt needs to weight the
first image harder.

---

## 7. Dark colourways · unresolved, needs the printer

Graphite on Winter White works. The same file on **Washed Black** would nearly vanish: the
owner's own black mockup shows the back print rendered light against dark fabric.

**One artwork cannot serve both light and dark garments.** Either a light-ink version is
generated for dark colourways, or the dark ones are dropped.

**Ask Red Hot Prints before building this.** It may be a per-colour print setup rather than
one file, which would change both the pipeline and the cost assumption that R70 covers
everything. Until answered, build against the light colourways and leave a seam for an
inverted variant.

---

## 8. The customer journey

Replaces the flow in `src/components/customizer/`. Every question now visibly populates the
garment, which is what makes them worth asking.

### Meet

1. **Their name.** Max 40 chars. Optional but asked first. Prints on both sides.
2. **Their photo.** Existing dropzone, moderation and downscale unchanged.
3. **What are they?** Dog · Cat · Bird · Reptile · Other. Selects the template.
4. **Their breed.** Searchable list filtered by species. Mixed breed is a first-class
   option, never buried at the bottom. `Other` skips this.
5. **Companion since.** Year only, four digits, **optional**.
   Label: `How long have they been with you?`
   Not `since when did you get them`, and never phrased in a way that assumes the animal is
   still alive. If it is skipped, the row is omitted from the plate entirely rather than
   printed empty.
6. **Temperament.** Three words, chosen from chips, for dog and cat templates.
   `Confident` · `Affectionate` · `Spirited` · `Gentle` · `Loyal` · `Playful` ·
   `Watchful` · `Fearless` · `Sleepy` · `Wise` · `Mischievous` · `Devoted`
   Bird and reptile templates use their own shorter field sets, see section 4.

### Create

Waiting state, roughly four seconds each:

1. `Looking closely at {name}...`
2. `Drawing their profile...`
3. `Setting it out on the plate...`

Never `Generating`, never `Processing`, never `AI`. On failure:
`That did not come out right. Let us try again.` and retry without spending a regeneration.

### Celebrate

**Show both sides.** A front and back toggle, or side by side on desktop. Both render on
the actual garment mockup in the chosen colourway.

- Heading: `Here they are`
- Primary action: `Take {name} home`
- Quiet: `Try another`, with `2 tries left` from the existing `REGEN_CAP` of 3.
  Regenerates both sides together.

The approval of the back is the whole safeguard for section 1's artistic licence. Do not
bury it behind a click that a customer can skip.

---

## 9. Data model

**`artworks`**, all nullable, additive `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`:

```ts
creatureName: text("creature_name"),        // max 40
species: text("species"),                   // dog | cat | bird | reptile | other
breedId: text("breed_id"),                  // null for "other" and free entries
companionSince: integer("companion_since"), // year, nullable
temperament: text("temperament"),           // JSON array of chip ids, validated
customFields: text("custom_fields"),        // JSON, "other" template only
frontKey: text("front_key"),                // canonical composited front
backKey: text("back_key"),                  // canonical composited back
```

`previewKey` and `printKey` semantics change: there are now two of each. Keep the existing
idempotency guarantees on the fulfilment side, per order item, per side. **Read the
fulfilment comments before touching them** — that code is what stops you paying to print
the same garment twice.

Validate every value against its known set before it reaches a template. Never interpolate
an unvalidated string into a print file.

**`products.ts`**: `printArea` becomes `printAreas: { front: Area; back: Area }`. The tote
has a back area only.

---

## 10. Order of work

1. Fix the approval bug, prompting spec section 1. Independent of everything here.
2. Colourways and `printAreas` in `products.ts`.
3. `breeds.ts` with a first twenty breeds, so the flow can be built against real data.
4. Reference image library, generated and hand reviewed.
5. Two-prompt generation with transparent backgrounds.
6. The compositing layer and the four back templates.
7. The journey.
8. Fulfilment, two files per item.

Steps 1 to 3 can start now. Step 6 is the largest and least certain: build it against one
template, dog and cat, and get that right before adding the other three.

---

## 11. Testing

Beyond the standard build, tests, lint and dash checks:

- **Likeness, front.** Six photographs including a black dog and a blurry phone photo. An
  owner must recognise their animal immediately.
- **Reference dominance, back.** A distinctively marked animal. If the markings vanish, the
  reference is winning and the prompt needs rebalancing.
- **Text integrity.** Every letter on the composited plate is correct at print resolution.
  Zoom to 100 percent and read it. This is the failure the whole compositing decision
  exists to prevent.
- **Transparency.** Open a print file over a dark background and confirm real alpha.
- **The approval promise.** Approve, run fulfilment, compare. Both sides must match what
  was approved.
- **Empty states.** No name, no companion-since year, `Other` species with one custom field.
  The plate must look deliberate, not broken, with rows omitted rather than blank.
