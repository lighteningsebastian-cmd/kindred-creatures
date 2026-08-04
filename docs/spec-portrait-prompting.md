# Spec: portrait generation · fixing likeness, consistency and print output

**For Claude Code. `src/lib/images/openai.ts`. Section 1 is a correctness bug and should be
fixed and committed before any prompt work.**

28 July 2026, after the first real generations with a live API key.

---

## 1. The bug: the customer does not receive the portrait they approved

`generatePreview` calls `render(uploadKey, style, "1024x1024")`.
`generatePrintFile` calls `render(uploadKey, style, "1536x1536")`.

**These are two separate API calls.** Image models are non-deterministic. The print file is
not a larger version of the approved preview, it is a **different picture of the same
animal in the same style.** Different pose, different light, different expression.

The entire brand promise is "you approve the portrait before we print". Today the customer
approves one portrait and receives another. Nobody has noticed because until yesterday
every image was a mock SVG, and no real order has been placed.

This will produce refunds on personalised, non-returnable goods. It is the most expensive
defect in the codebase.

### The fix

Generate **once**, at print resolution, and derive the preview from it.

1. `generatePreview` renders at the largest size the model supports and stores those bytes
   as the artwork's canonical image.
2. The customer-facing preview is a downscaled, watermarked copy of **those exact bytes**.
   A watermarking helper already exists in the mock provider for reference.
3. `generatePrintFile` **does not call the model.** It reads the stored canonical bytes and
   resizes to the product's `printPixels`. Regeneration at fulfilment time is removed
   entirely.
4. `Try another` replaces the canonical image. The last one generated before checkout is
   the one that ships.

This also removes one paid API call per order item, so it is cheaper as well as correct.

**Do not skip the test:** place a sandbox order, approve a portrait, run fulfilment, and
confirm the print file is pixel-identical to the approved preview apart from scale and
watermark.

---

## 2. Transparent backgrounds

The current prompts produce a solid background. Printed on a Stone hoodie, a portrait with
a white background is **a white rectangle with a dog in it.**

`gpt-image-1` supports a transparent background, which is what garment printing wants:

```ts
const result = await client.images.edit({
  model: "gpt-image-1",
  image,
  prompt,
  size,
  background: "transparent",
  output_format: "png",
});
```

`background: "transparent"` requires a PNG or WebP output format. The existing
`sniffImageExtension` will correctly detect PNG, and yesterday's `imageMimeForExtension`
fix means it is stored with the right content type.

**Verify with a real print file before trusting it.** Open the PNG over a dark background
and confirm the alpha channel is genuinely transparent rather than white pixels.

---

## 3. Why the portraits were inconsistent

The whole prompt is currently one sentence:

```
Turn this pet photo into a warm, painterly classic pet portrait, soft studio lighting,
museum framing, dignified pose.
```

Three problems.

**It never asks the model to preserve the animal.** Nothing says keep these markings, this
coat, these ears, this face. Given a vague instruction the model drifts toward a generic
handsome example of the breed. That is the single biggest cause of a portrait that is
lovely and not theirs.

**It has no negative constraints.** Nothing forbids text, borders, signatures, watermarks,
human hands, or scenery. Each of those appears at random, which is exactly what
"inconsistent" looks like in practice.

**"museum framing" is actively harmful.** It invites the model to draw an actual picture
frame, which then gets printed onto the hoodie. Remove it.

---

## 4. Prompt structure

Compose from three parts rather than one string: a fixed subject clause, a style clause,
and a fixed constraint clause. Consistency comes from the two fixed parts.

```ts
const SUBJECT =
  "A portrait of THIS SPECIFIC animal from the photograph. Preserve its exact " +
  "markings, coat colour and pattern, ear shape, eye colour and facial structure. " +
  "The likeness must be unmistakable to its owner.";

const COMPOSITION =
  "Head and shoulders, centred, generous even margin around the subject, " +
  "facing the viewer.";

const CONSTRAINTS =
  "No background scenery. No frame, no border, no text, no lettering, no signature, " +
  "no watermark, no human hands, no collar tags with writing. " +
  "Transparent background. Suitable for printing on fabric.";
```

### There are two prompts, and they are the two sides of the garment

**Owner decision, 3 August 2026: one house style.** The three-way choice (Timeless,
Understated, Soft) is gone from the interface, from `content.ts` and from the prompt file.
What varies now is not taste but which side of the garment is being drawn, and the two
sides genuinely need different pictures:

| Side | Medium | Pose | Why |
|---|---|---|---|
| `front` | Colour, painterly oil | Facing the viewer | The left-chest patch, seen across a room |
| `back` | Graphite, monochrome | Strict side profile | Sits inside an archival plate of typeset rules and data, where colour fights the type |

Both the medium and the composition are keyed by side:

```ts
const prompt = [
  SUBJECT,
  // Only when a second image is really attached. Section 6a, 4 August.
  ...(hasReference ? [REFERENCE] : []),
  STYLE_CLAUSE[side],
  COMPOSITION[side],
  CONSTRAINTS,
].join(" ");
```

`REFERENCE` is the only conditional clause. Every other clause is sent on every call.

**The back is the one that needs watching.** It is drawn from a face-on photograph, so the
profile has to be inferred, which is why the back is the side that receives the breed's
hand-reviewed side-profile reference as a second input. Ask for the profile plainly and
more than once: a model handed a face-on photo drifts back to face-on given any room, and
a three-quarter view inside an archival plate reads as a mistake rather than a portrait.

**Two images means the prompt must say which is which.** Naming them is what keeps the
reference from lending its own coat to the portrait. See section 6a.

**Before 3 August both sides were asked for the same face-on colour portrait**, differing
only in whether the reference was attached. The back was never the profile this document
described.

**These are a hypothesis.** They are reasoned, not proven. Test and revise. Keep the
structure, change the wording.

---

## 5. Nature fragments

When the customer journey spec ships, the nature chip inserts one fragment **between** the
style clause and the composition clause, on both sides. Fragments modify light, expression and mood only.
They must never contradict the subject clause: likeness always wins over mood.

See `docs/spec-customer-journey.md` section 6 for the mapping table.

---

## 6. Testing protocol

Prompt work cannot be verified by reading code. Run it.

**Set a hard spend cap in the OpenAI dashboard first.**

### Test A · likeness, six photographs

A dog in good light · a black dog, the hardest case for any model · a cat · a
dark-on-dark or backlit photo · two pets in one frame · a blurry phone photo, because that
is what customers actually send.

For each, both sides. Twelve images, well under a dollar. (Was eighteen, when there
were three styles.)

Pass: an owner would recognise their own animal immediately.
**The black dog and the blurry phone photo are the ones that decide whether this is a
business.** Everything works on a well-lit golden retriever.

### Test B · consistency

One photograph, one side, five runs. Pass: five images that clearly belong to the same
range. If run three looks nothing like run one, the constraints are too loose.

### Test C · print readiness

Take one print file. Open it over a dark background and confirm real transparency. Check
there is no text, border or frame anywhere in the image. Check the subject sits within the
margin and is not cropped at the edges.

### Test D · the approval promise

The section 1 fix. Approve a preview, run fulfilment, compare. They must match.

### Test E · reference bleed · the one that guards the new clause

**Only for the back, and only for a breed whose reference illustration is stored.**

Pick a dog with a marking the reference cannot have: a patch over one eye, a white blaze,
odd socks, heterochromia. Generate the back three times.

Pass: the marking is on every one of the three, and the coat is the animal's own.
Fail: the marking is missing, faint, or has migrated. That means the reference is
dominating, and `REFERENCE` in `prompts.ts` is claiming more than it should.

Run this **whenever `REFERENCE` is edited.** It is the only test that can catch the
failure that clause exists to prevent, and it cannot be run offline.

Record what you learn in this file. Prompt work is empirical and undocumented findings get
rediscovered expensively.

---

## 6a. Findings

### 4 August 2026 · two images and nothing saying which was which

**Found by reading, not by generating. Not yet validated against a photograph.**

Since the back portrait started sending the breed's side-profile reference as a second
image, the prompt has never said which attached image is which. `SUBJECT` says "A portrait
of THIS SPECIFIC animal from the photograph" — with two images attached, the model had to
guess which one that noun meant.

The guess is not random. The reference illustration is *already in the pose we asked for*,
so it is the more obliging answer, and the predicted failure is the reference's coat
colour, markings and proportions bleeding into the portrait. That is the "handsome,
generic example of the breed" this document's section 3 identifies as the single biggest
cause of a portrait that is lovely and not theirs.

**Fixed by a new conditional clause,** `REFERENCE` in `prompts.ts`, sitting directly after
`SUBJECT`. `PROMPT_VERSION` is now `2026-08-04.1`, so any back portrait drawn before that
version was drawn without the disambiguation and cannot be compared against one drawn
after it.

The clause only reaches the model when a reference was really attached. One of One entries
and every breed the library has not reached yet are drawn from the photograph alone, and a
sentence about a SECOND image that is not there is a worse instruction than silence. The
condition is derived from the reference **bytes**, not from the reference key: a key whose
bytes are missing falls back to one image, and the wording falls back with it.

**The decision inside the clause: only the head angle and pose come from the reference.**
Not the skull, not the muzzle, not the ear set. `SUBJECT` has already claimed ear shape and
facial structure for the photograph, and a prompt that claims the same thing twice does not
split the difference — it lets the model choose, and choose differently on every run.

This resolves a contradiction the specs had been carrying: `spec-companion-profile.md`
justifies the reference library as existing "so the model is not inventing skull shape and
ear set from nothing" (section 5), while the prompt in its own section 6 takes "only the
head angle and pose". The narrow reading wins. The cost is real and accepted: on a very
flat or very long face, the profile is inferred from a face-on photograph and may come back
approximate. A slightly generic profile is a portrait nobody remarks on. The customer's own
dog with the wrong coat is a refund on a garment already printed and posted.

**What is still unknown, and needs a live key with a spend cap:**

- Whether `gpt-image-1` honours ordinal references ("the FIRST image") at all. If it does
  not, this clause is decoration and the fix is a different shape — likely weighting the
  photograph by repetition rather than by naming.
- Whether the bleed was actually occurring, and how badly. It is predicted from how the
  model is being asked, not observed.
- Whether the narrow reading leaves flat-faced breeds (pug, bulldog, Persian) too
  approximate to sell. If it does, widen `REFERENCE` deliberately and re-run Test E, rather
  than widening it because a single profile looked wrong.

Test E is the protocol for all three.

---

## 7. Known constraint

`gpt-image-1` is scheduled for deprecation on **23 October 2026**. Newer image models are
available. Not urgent, but any prompt tuning done now is an investment in a model with a
known end date, and the migration should be deliberate rather than an emergency when
portraits stop generating mid-order. Revisit after launch.
