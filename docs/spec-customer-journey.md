# Spec: the customer journey, Meet · Create · Celebrate

**For Claude Code. This replaces the flow in `src/components/customizer/`. Read all of it
before starting. Supersedes `CUSTOMER_JOURNEY_REDESIGN.md` at the repo root.**

Version 2, 28 July 2026, after owner pushback on version 1.

---

## The argument this is built on

The flow today is `Step 1 · Your photo → Step 2 · Your style → Step 3 · Add to cart`. It
is a form. At R999 for a hoodie it does not earn the price.

Version 1 of this spec asked for a name and nothing else before the reveal, on the grounds
that questions before value are friction. The owner rejected that, correctly: **at these
prices the customer must feel the portrait exists because of them, not merely from their
photo.** A photo upload is a transaction. A conversation about their animal is a
commission.

So the flow asks more. But it comes with a hard condition.

### The condition: the answers must genuinely change the artwork

Every answer we collect before the portrait is drawn **must be fed into the image prompt
and must visibly change the output.**

Not because of principle, because of arithmetic. A customer who orders twice, once for a
goofy spaniel and once for a regal greyhound, and receives two portraits drawn identically,
has learned that the questions were decoration. On a premium brand bought as a keepsake,
that discovery is expensive and it is permanent.

The cost of doing it properly is zero. The prompt is a string. Appending `with an air of
quiet mischief` costs nothing per call. What it costs is **prompt engineering and testing**,
which is already on the project board as High priority.

**This spec therefore has a dependency: it cannot ship until the OpenAI key is live and the
prompt mapping in section 6 has been tested against at least twenty real photographs.** The
mock provider ignores prompts entirely, so a flow that looks perfect in development proves
nothing. Build it, but do not put it in front of a paying customer until the answers
demonstrably move the picture.

---

## The flow

```
MEET                          CREATE                      CELEBRATE
name · photo · nature    →    feeling · crafting     →    reveal · provenance · card
```

Four inputs before the reveal, three of them single taps. Target: under sixty seconds.

---

## MEET

### Screen 1 · Their name

**Eyebrow:** `Meet` · **Heading:** `Introduce us to your best friend`

- Label: `What do you call them?` · Placeholder: `Luna` · max 40 chars
- **Optional.** Never block. For someone ordering after a loss, this field can be the
  hardest thing on the page.

Once given, the name replaces generic language on every screen and email that follows.
Build one helper so no component reimplements the fallback:

```ts
/** "Luna" when named, "them" otherwise. Never renders an empty gap. */
export function creatureName(name: string | null): string;
```

| Generic | With a name |
|---|---|
| `Choose a style` | `How should we draw Luna?` |
| `Creating your portrait` | `Getting to know Luna` |
| `Add to cart` | `Take Luna home` |

### Screen 2 · Their photo

Existing `UploadDropzone`, relabelled. Moderation, downscale and error handling unchanged.

- Label: `Share the photo that captures {name} best`
- Helper: `Good light and a clear look at their face is all we need.`

### Screen 3 · Their nature

**This is the screen that earns the price.** One tap, no typing.

**Heading:** `What is {name} like?`
**Body:** `This shapes how we draw them, so pick the one that feels most true.`

That sentence is a promise. Section 6 is how we keep it.

Eight chips, single select, required:

`Gentle` · `Goofy` · `Loyal` · `Fearless` · `Regal` · `Mischievous` · `Sleepy` · `Wise`

Required, unlike the name, because it feeds the prompt. If a customer will not choose, do
not block the sale: default to `Gentle` silently after a skip link, and never tell them
their answer was ignored.

---

## CREATE

**Eyebrow:** `Create` · **Heading:** `How should we draw {name}?`

Three styles, relabelled to feelings. `ArtStyle` values unchanged, display only.

| `ArtStyle` | New label | Description |
|---|---|---|
| `classic-portrait` | `Timeless` | Warm, painterly, framed like a keepsake. |
| `line-sketch` | `Understated` | Clean single-line ink, quiet and modern. |
| `watercolor` | `Soft` | Soft washes with a hand-painted feel. |

### The waiting state

Fifteen seconds of someone wondering whether they have wasted their money. **Reflect their
own words back at them.** This is where the sense of commission is built.

Rotate, roughly four seconds each:

1. `Looking closely at {name}...`
2. `Finding the {nature} in them...` · lowercase the chip: "Finding the mischievous in them"
3. `Taking our time with this one...`

Never `Generating`, `Processing`, or `AI`. On failure: `That did not come out right. Let us
try again.` and retry **without** spending a regeneration.

---

## CELEBRATE

The emotional peak of the product. Give it room.

- Heading: `Here they are`
  No pronoun is asked for and none is guessed. `They` is warm and always correct.
- Portrait renders large on the garment mockup via the existing `PreviewStage`.

### The provenance line · this is what makes it feel commissioned

Directly beneath the portrait, quiet, small caps, muted:

```
Drawn for Luna · mischievous · timeless
```

**This single line is the highest-value element in the spec.** It is the visible proof that
their answers produced this specific picture. Without it the influence is invisible and
the questions feel like a quiz. With it, the customer sees their own words attached to the
thing they are about to buy.

Carry the same line onto the cart item, the order confirmation email and the order status
page. It should follow the portrait everywhere the portrait goes.

### Actions

- Primary: `Take {name} home`
- Quiet text button: `Try another`, with `2 tries left` beneath, from the existing
  `REGEN_CAP` of 3. Never `regenerate`.

### Then, and only then, the card

Revealed **after** the portrait, below the primary action. Never gates the purchase.

**Heading:** `Add a card to the box`
**Body:** `We tuck a small printed card in with every order. Tell us what you would want to
remember about {name} and we will put it on there.`

One optional input: free text, max 80 characters.
Placeholder: `The face that greets me every day.`

Printed as:

```
Luna
Mischievous

The face that greets me every day.
```

With no answer, the card falls back to `Every pet has a story worth celebrating.`
**The card ships either way.**

---

## 6. Prompt mapping · the part that makes this honest

**`src/lib/images/provider.ts`** gains a nature field on the generate input, and
`openai.ts` composes it into the prompt.

Starting fragments. **These are a hypothesis, not a specification.** They must be tested
against real photographs and revised. Ship whatever survives testing.

| Chip | Prompt fragment |
|---|---|
| Gentle | `a soft, calm expression, gentle warm light, relaxed posture` |
| Goofy | `a playful open expression, bright lively light, a sense of motion and humour` |
| Loyal | `a steady direct gaze meeting the viewer, warm even light, calm and present` |
| Fearless | `an alert confident posture, strong directional light, bold contrast` |
| Regal | `an upright noble bearing, rich deep tones, formal portrait composition` |
| Mischievous | `a knowing sidelong glance, an air of quiet mischief, lively warm light` |
| Sleepy | `a drowsy contented expression, soft diffused light, deep restfulness` |
| Wise | `a thoughtful settled expression, muted timeless palette, quiet dignity` |

**Constraints on the prompt work:**

1. **Likeness beats mood, always.** These fragments modify atmosphere, light and framing.
   They must never override what the animal actually looks like. A customer who receives a
   portrait that is beautifully "regal" but does not look like their dog will ask for a
   refund, and will be right to.
2. **Do not attempt pose changes.** Asking the model to reposition an animal from a
   photograph degrades likeness fastest of all.
3. **Test the difference is visible.** Run the same photograph through all eight chips. If
   a reasonable person cannot tell `Goofy` from `Regal` side by side, the mapping has
   failed and the promise on the Nature screen is false. Fix the mapping or weaken the
   promise. Do not ship the gap.
4. The name, and the card line, are **never** sent to the provider. They are for the
   experience and the printed card. Only `nature` and `style` reach the prompt.

---

## 7. Data model

**`src/lib/db/schema.ts`** on `artworks`, all nullable, additive
`ALTER TABLE ... ADD COLUMN IF NOT EXISTS` per existing convention:

```ts
creatureName: text("creature_name"),   // max 40, display only, never sent to the provider
creatureNature: text("creature_nature"), // one of the eight chips, feeds the prompt
creatureLine: text("creature_line"),   // max 80, printed card only
```

- Sanitise on write: trim, collapse whitespace, strip control characters, enforce caps
  server side. These strings reach an email template and a print job sheet.
- `creatureNature` must be validated against the known set, exactly as `isArtStyle` already
  validates styles. Never interpolate a free string into a prompt.
- Reorder must survive nulls. Old artwork has none of these. Fall back and never render
  `undefined`.

### Where the answers travel

| Surface | Use |
|---|---|
| Cart line | `The Kindred Hoodie · Luna` |
| Order confirmation email | `Thank you for trusting us with Luna's story` |
| Portrait ready email | `Luna is ready` |
| Shipping email | `Luna is on the way` |
| Order status page | `Luna's hoodie`, with the provenance line |
| Admin order list | Name beside the order, so support is human |
| Print job sheet | Name, nature and card line, so the card can be printed |
| `/account` reorder | `Luna's portrait`, not `Artwork a3f9c2` |

---

## 8. What this spec still refuses to do

**No pronoun question.** Asking someone to declare their dog's gender in a form is a strange
moment, and getting it wrong in an email is worse than never claiming it.

**No future tense about the animal, anywhere in this flow or its emails.** A meaningful
share of custom pet portraits are ordered within a week of a loss, by the customers who
care most and spend most. Banned: `bring them to life`, `can't wait to meet them`,
`they'll love it`. Every line here works whether the animal is asleep on the sofa or buried
in the garden. Check new copy against that before shipping.

**No percentage progress bar.** A stalled percentage is worse than none.

**No question that does not do visible work.** Three questions reach the customer: the name
appears everywhere, the nature changes the drawing and appears in the provenance line, the
card line gets printed and put in the box. If a fourth is ever proposed, it needs an answer
to "and where does the customer see this?" before it goes in.

---

## 9. Verify before commit

```
npm run build
npx vitest run
npm run lint
grep -rn "—\|–" src --include=*.tsx --include=*.ts
grep -rni "generat" src/components src/app --include=*.tsx | grep -v test
```

Manual:

- Full flow with name and nature. Confirm both appear in the provenance line, cart, job
  sheet and emails.
- Full flow with **no** name. Every screen reads naturally with `them`, nothing renders
  `undefined` or a double space.
- Skip the nature chip. Confirm the silent `Gentle` default and no error.
- Reorder artwork created before this change. No crash, sensible fallback.
- 40 characters of emoji in the name. Job sheet and email survive.

**Before it reaches a paying customer:** run one photograph through all eight nature chips
with the real provider and put the results side by side. If the differences are not
obvious, the Nature screen is making a promise the product does not keep.

Commit in order: data model · Meet · Create · Celebrate · provenance line · prompt mapping ·
downstream surfaces.
