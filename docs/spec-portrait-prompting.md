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

## 3. Why the styles are inconsistent

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

Style clauses, replacing `STYLE_PROMPT`:

| `ArtStyle` | Customer label | Style clause |
|---|---|---|
| `classic-portrait` | Timeless | `Rendered as a warm painterly oil portrait with visible soft brushwork, gentle directional light, a muted natural palette.` |
| `line-sketch` | Understated | `Rendered as a single-weight black ink line drawing, clean continuous contour lines, no shading, no hatching, no fill.` |
| `watercolor` | Soft | `Rendered as a loose watercolour with gentle washes and visible paper texture, soft edges, a limited muted palette.` |

Final prompt:

```ts
const prompt = [SUBJECT, STYLE_CLAUSE[style], COMPOSITION, CONSTRAINTS].join(" ");
```

**These are a hypothesis.** They are reasoned, not proven. Test and revise. Keep the
structure, change the wording.

---

## 5. Nature fragments

When the customer journey spec ships, the nature chip inserts one fragment **between** the
style clause and the composition clause. Fragments modify light, expression and mood only.
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

For each, in each of the three styles. Eighteen images, well under a dollar.

Pass: an owner would recognise their own animal immediately.
**The black dog and the blurry phone photo are the ones that decide whether this is a
business.** Everything works on a well-lit golden retriever.

### Test B · consistency

One photograph, one style, five runs. Pass: five images that clearly belong to the same
range. If run three looks nothing like run one, the constraints are too loose.

### Test C · print readiness

Take one print file. Open it over a dark background and confirm real transparency. Check
there is no text, border or frame anywhere in the image. Check the subject sits within the
margin and is not cropped at the edges.

### Test D · the approval promise

The section 1 fix. Approve a preview, run fulfilment, compare. They must match.

Record what you learn in this file. Prompt work is empirical and undocumented findings get
rediscovered expensively.

---

## 7. Known constraint

`gpt-image-1` is scheduled for deprecation on **23 October 2026**. Newer image models are
available. Not urgent, but any prompt tuning done now is an investment in a model with a
known end date, and the migration should be deliberate rather than an emergency when
portraits stop generating mid-order. Revisit after launch.
