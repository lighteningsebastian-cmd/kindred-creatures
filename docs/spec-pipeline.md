# Spec: the commission pipeline · configure, pay, draw, approve, print

**For Claude Code. This is the master flow spec. It replaces
`docs/spec-customer-journey.md` entirely and changes when generation happens.
`docs/spec-print-layout.md` still governs what the plate looks like.**

30 July 2026.

---

## 1. What changed, and why

Generation used to happen **before** payment. It now happens **after**.

The reason is arithmetic. Front and back at print quality is roughly R7 a
generation. A hoodie leaves about R405. At a hundred people generating for every one
who buys, free pre-purchase generation costs R2,100 to earn R405. The business cannot
carry it, and the money is needed for marketing rather than for people trying their
neighbour's dog.

**But the product must not feel like it lost anything.** So:

- Before paying, the customer sees the **real plate** with **their** pet's name, breed
  data, temperament and chosen garment colour. Only the illustration is a breed stock
  image. That costs nothing and delivers most of the emotional payoff.
- After paying, we draw their actual animal and **they approve it before anything is
  printed**. The promise that has always been on the site stays exactly true. It simply
  happens after payment instead of before.

Frame it as a **commission**, never as a preview. Nobody expects to see a commissioned
portrait before commissioning it.

---

## 2. The flow

```
1  Choose garment, colour, size
2  Tell us about them        name · species · breed · temperament · year
3  Preview                   real plate, stock illustration, their data
4  Upload their photo
5  Pay
6  We draw it                front colour face-on · back graphite profile
7  Approve                   on our own site, from an emailed link
8  Print
```

Steps 6 and 7 loop: two automated revisions, then a human.

---

## 3. Before payment

### 3.1 Configure

Existing `ProductConfigurator`. Colour, size, fit. Heading: `Make it yours`.

### 3.2 Tell us about them

Heading: `Introduce us to your best friend`

| Field | Required | Notes |
|---|---|---|
| Name | No | Max 40 chars. Printed both sides. |
| Species | Yes | Dog · Cat · Bird · Reptile · Other |
| Breed | Yes, except Other | Searchable list from `src/lib/breeds.ts` |
| Temperament | Yes, dog and cat | Exactly three chips |
| Together since | No | Year only, four digits |

**Breed picker.** Search filtered by species. `One of One` is offered at the top of the
list, never buried at the bottom. Below the results: `Can't find them?` which captures
what they typed into a `breed_requests` table. Every miss is a signal for what to add
next, ordered by real demand.

**Other species.** Horses, donkeys, anything else. No breed list. Up to three
customer-supplied label and value pairs, 24 and 32 characters. Header reads
`COMPANION PROFILE` in place of a breed name.

**Temperament chips.** `Confident` · `Affectionate` · `Spirited` · `Gentle` · `Loyal` ·
`Playful` · `Watchful` · `Fearless` · `Sleepy` · `Wise` · `Mischievous` · `Devoted`

**The year question is phrased carefully.** Label: `What year did they come into your
life?` Never `birthday`, never `date of birth`, never a full date. See the headstone
constraints in `docs/spec-print-layout.md`. Optional, and the row is omitted when absent.

### 3.3 The preview · zero API cost

Render the **real plate**, both sides, on the chosen garment and colour, using
`stockKey(breed)` in place of the portrait. Their name, their breed data, their
temperament, their year. Live-update as they answer: typing the name puts it on the
plate, choosing the breed fills in ORIGIN and GROUP on their own.

**Directly beneath the preview, quietly, always:**

> The illustration shown is a Yorkshire Terrier example. Yours will be drawn from your own
> photo, in the style you choose.

Substitute the actual breed name. This line is not optional and must never be
collapsed behind a tooltip. It is the difference between a clever preview and a
complaint, and it promises something better than what they are looking at.

Note both halves of that sentence. The stock illustration is **not their pet** and it is
**not necessarily their chosen style**: the breed library is generated in the house style
only, so a customer who picks watercolour still sees a house-style example. The preview
communicates layout, data and garment, never the finished artwork.

For `One of One` and `Other`, drop the breed name: `The illustration shown is an example.
Yours will be drawn from your own photo, in the style you choose.`

### 3.4 The style picker

Three styles. The `ArtStyle` values are unchanged; only the labels and the examples change.

| `ArtStyle` | Label | Description |
|---|---|---|
| `classic-portrait` | Timeless | Warm and painterly, framed like a keepsake. |
| `watercolor` | Soft | Gentle washes with a hand-painted feel. |
| `line-sketch` | Understated | Clean ink line, quiet and modern. |

**Each style shows one real example image.** One per style, three in total, generic rather
than per breed. They replace the paw-print placeholders currently rendered, which explain
nothing.

Two rules for those three images:

1. **Produced by the real pipeline**, never mocked up by hand. An example that flatters
   what the product actually makes engineers a disappointment on every first order.
2. **The same animal in all three**, so the comparison isolates the style rather than the
   pet. Not a golden retriever in good light: pick something that proves the style holds
   up on a harder subject.

### 3.5 Photo upload

After the preview, before checkout. Existing dropzone, moderation and downscale
unchanged. Required to check out.

Helper: `Good light and a clear look at their face is all we need.`

---

## 4. After payment

Generation is triggered from the **existing fulfilment hook** that already runs after the
verified PayFast ITN webhook. Do not add a second trigger path, and do not weaken the
webhook's verification. Read the comments in `src/lib/fulfillment.ts` first: that code is
what stops the business paying to print the same garment twice.

1. Generate the **front**: colour, face-on, from their photo. Faithful likeness.
2. Generate the **back**: graphite, side profile, from their photo plus
   `referenceKey(breed)` as a second input.
3. Composite both into the plate templates.
4. Store as the canonical assets. **The print file is a resize of these bytes and is never
   regenerated.**
5. Email the approval link.

**Missing reference.** `referenceKey()` returns null for every `One of One` entry, and
will return a key that does not exist yet while the library is being built. Both cases
fall back to generating from the photograph alone, log a warning, and **never throw**. An
order must never fail because an illustration is missing.

**Generation failure.** Retry once. If it fails again, flag the order for the owner and
email the customer that it is taking a little longer. Never leave a paid order silent.

---

## 5. The approval page

A signed link, same HMAC pattern as the existing order-status tokens
(`src/lib/order-token.ts`). Viewing it must never log anyone in.

**Heading:** `Here they are`
Both sides shown on the garment, large.

Two actions:

- **Primary:** `Yes, print it`
- **Secondary, quiet:** `Something is not quite right`

Approval writes an approval timestamp and releases the job sheet to the printer. Until
then, nothing is sent.

### The revision panel

Opens under `Something is not quite right`. In this order:

**1. Use a different photo.** Offered first, and it is the most likely fix. When a portrait
does not look like someone's dog, the photograph is usually the reason. Same dropzone,
same moderation.

**2. What is not right?** Multi-select chips:

`Doesn't look like them` · `Wrong colouring or markings` · `Too dark` · `Too light` ·
`Wrong angle` · `Something else`

Each chip maps to a prompt adjustment **we** wrote, in `src/lib/images/prompts.ts`.

**3. Anything else you would like us to know?** Free text, optional, max 300 characters.

---

## 6. Safety · customer text never reaches the model

**This is a hard rule with no exceptions.**

Free text goes to the **admin queue for a human to read**. It is never concatenated into a
prompt, never passed to the image API, never used to build any instruction. A text box
that feeds a prompt hands a stranger the controls on something we print and post.

Only two things influence generation: the **validated chip ids**, and the **photograph**.
Chips are validated against a known set exactly as `isArtStyle` already validates styles.
Never interpolate an unvalidated string.

The name is printed, not prompted. Validate it for printable glyph coverage and run a
profanity check at input time, so a customer learns their character cannot be printed
while typing rather than after paying.

---

## 7. The revision ladder

| Round | What happens |
|---|---|
| 1 | Automated. Regenerate with the chip adjustments, or the new photo. New approval email. |
| 2 | Automated. Same. |
| 3 | **Stops. Flags for the owner.** Customer sees: `Let me look at this one myself. I will be in touch today.` |

**Never show a counter.** No "1 of 3 revisions remaining". A visible limit turns a service
into a ration and makes the customer adversarial. The tone simply escalates into personal
attention, which reads as better service rather than as running out of chances.

Worst case is about R21 of generation on a R405 contribution. Affordable.

---

## 8. Emails

| Trigger | Subject |
|---|---|
| Payment confirmed | `Thank you for trusting us with {name}'s story` |
| Artwork ready | `{name} is ready to see` |
| Revision ready | `Another look at {name}` |
| Approved | `{name} is going to print` |
| Shipped | `{name} is on the way` |

Fall back to `them` and `your companion` where no name was given. No future tense about
the animal anywhere: no `bring them to life`, no `can't wait to meet them`. Every line
must work whether the animal is asleep on the sofa or gone.

---

## 9. Admin

The owner needs one screen: **orders awaiting approval**, showing the order, both rendered
sides, how many revisions have happened, and any free text the customer wrote.

Actions: regenerate, mark for personal contact, release to print.

`breed_requests` is a second, simpler list: what people searched for and could not find,
with counts.

---

## 10. Data model

On `artworks`, all nullable, additive `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`:

```ts
creatureName: text("creature_name"),
species: text("species"),
breedId: text("breed_id"),
temperament: text("temperament"),        // JSON array of validated chip ids
togetherSince: integer("together_since"), // year only. NO end-date field, ever.
customFields: text("custom_fields"),      // JSON, "other" species only
frontKey: text("front_key"),
backKey: text("back_key"),
revisionCount: integer("revision_count").default(0),
approvedAt: timestamp("approved_at"),
promptVersion: text("prompt_version"),
```

New table `breed_requests`: id, query text, species, created_at.

**`togetherSince` is a single nullable integer and there is no second date field.** Not
"we do not ask for it" but "it cannot exist". A field that exists eventually gets
populated, and two dates on a plate is a headstone.

---

## 11. What is removed

Delete rather than leave dormant:

- Pre-purchase generation and the whole live customizer wait state
- The regeneration cap and its counter, `REGEN_CAP`
- Rotating waiting-state copy
- The paw-print style placeholders, replaced by the three real examples in 3.4

**Style selection stays.** Owner decision, 30 July. Three styles, one example image each.

---

## 11b. The image library the owner produces

For reference while building. None of this blocks sections 1 to 6.

| Set | Count | Purpose |
|---|---|---|
| Breed fronts, house style | 55 | `stockKey()`, the preview illustration |
| Breed profiles, house style | 55 | `referenceKey()`, the pose reference fed to generation |
| Style examples | 3 | The style picker, one per style |
| **Total** | **113** | |

The four `One of One` entries have no profile reference by design and generate from the
photograph alone.

The breed library is house style only. It is never regenerated per style: a customer who
chooses watercolour sees a house-style stock illustration and is told so by the line in
3.3. Their own artwork is drawn in the style they picked.

---

## 12. Build order

Steps 1 to 6 need **no breed images** and can start immediately.

1. Data model and migrations
2. Breed picker and `breed_requests` logging, against `src/lib/breeds.ts`
3. The tell-us-about-them form
4. Plate composition with a placeholder portrait, per `docs/spec-print-layout.md`
5. Preview using `stockKey`, with the honesty line, and a graceful placeholder while the
   image library is empty
6. Approval page, revision panel, emails, admin queue
7. Move generation into the fulfilment hook
8. Wire the real references once the library lands

---

## 13. Verify

```
npm run build
npx vitest run
npm run lint
grep -rn "—\|–" src --include=*.tsx --include=*.ts
grep -rni "mixed breed" src
```

Manual:

- Complete the flow with no name, no year, `One of One`. Plate looks deliberate, not broken.
- A missing reference image logs a warning and still produces artwork.
- Free text containing an instruction such as `ignore previous instructions` reaches the
  admin queue and **provably never reaches the image API**. Assert this in a test.
- The approval link does not log anyone in.
- Two revisions escalate to the owner, and no counter is ever shown to the customer.
- The honesty line appears under every stock preview, naming the correct breed.
