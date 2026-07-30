# Spec: fixing the profile flow

**For Claude Code. Owner reviewed the live flow on 30 July and rejected it. This is what
is wrong and what replaces it. Several of these trace to bad wording in my earlier specs,
noted where relevant so they are not repeated.**

---

## 1. "Detail 1 · Value 1" · delete this entirely

`docs/spec-pipeline.md` said *"up to three customer-supplied label and value pairs"*. That
wording produced a generic key/value grid, and it is the worst thing on the page. A
customer with a horse should not be asked to invent a form field.

**Replace the `Other` species branch with named questions**, mapping directly onto plate
rows:

| Question | Plate row | Required |
|---|---|---|
| `What kind of animal are they?` | `SPECIES` | Yes |
| `Breed or type, if they have one` | `BREED` | No |
| `Where are they from?` | `ORIGIN` | No |

Plus the same temperament chips every other species gets. Free text, sanitised, capped at
32 characters each. Rows with no value are omitted from the plate, as everywhere else.

No `customFields` array. No numbered rows. Three named inputs.

---

## 2. The date question is too vague

Currently a bare year. Give it a real question, worded so it works for a rescue, a
purchase, or an animal that has died:

> **When did they come into your life?**
> Adoption day, gotcha day, or birthday. The year is enough.

Still year only, still optional, still no second date field, ever. See
`docs/spec-print-layout.md` section 3.

---

## 3. Chip colours are wrong

`CompanionForm.tsx` has:

```ts
const chipOn = "border-ink bg-ink text-base";
```

`bg-ink` is the near-black body colour. The design system's selected state is **oxblood
accent**, and the site uses it consistently everywhere else. A black chip is a foreign
object on a parchment page.

Use the accent token for the on state, and the existing hairline border style for off.
Check `design/DESIGN-SYSTEM.md` and match the existing `Button` component rather than
inventing a chip style. **Every interactive state in this form must be drawn from the
design system.** Nothing bespoke.

---

## 4. Breed search · already fixed in `src/lib/breeds.ts`

Typing `b` returned Labrador Retriever, because `.includes` matched the b in the middle of
the word. Now ranked: exact, then name-start, then word-start, then mid-word.

Two things for the picker component:

- An empty query now returns `popularBreeds()`, six entries, not all thirty-five. Render
  that shortlist under a quiet heading such as `Most common` rather than as a raw dropdown.
- Cap visible results at **eight**, with the rest reachable by typing more. A wall of
  thirty-five names is not a menu.

---

## 5. The real problem: the flow has no live preview

This is the substantive change and the reason the page feels poor.

Today the customer fills in a form and, somewhere below it, a plate appears. The garment
is not in the picture at all. Colour changes do nothing visible. There is no moment where
they see the thing they are buying.

### What replaces it

**A persistent, live preview panel that is always on screen.**

```
DESKTOP                              MOBILE
┌──────────────┬──────────────┐      ┌────────────────────┐
│              │              │      │  PREVIEW (sticky)  │
│   THE FORM   │   PREVIEW    │      ├────────────────────┤
│  (scrolls)   │  (sticky)    │      │                    │
│              │              │      │   THE FORM         │
│              │  front/back  │      │   (scrolls)        │
└──────────────┴──────────────┘      └────────────────────┘
```

Rules:

1. **The preview is never hidden and never gated.** It renders from the first paint with
   the garment in its default colour and an empty plate. It fills in as they answer.
2. **The garment is the background.** Use `public/garments/<product>/<colour>/<side>.webp`
   per `docs/spec-garment-mockups.md`, with the plate composited on top. Not a floating
   plate on a blank page.
3. **Everything updates instantly.** Changing colour swaps the garment photo. Typing a
   name puts it on the plate. Choosing a breed fills ORIGIN and GROUP on their own. That
   last moment is the one that sells the product: make sure it is visible without
   scrolling.
4. **Front and back toggle**, within the preview panel. Default to back, because the plate
   is the product.
5. **Remove the `active` gate.** The form must not be hidden behind a colour and size
   choice. The owner has now twice looked at the page and believed it was broken. A
   customer will simply leave.

### Order of the form

The preview is on screen throughout, so ordering is about momentum, not gating.

1. **Their name** · one field, instant reward, it appears on the plate
2. **What are they?** · species
3. **Their breed** · the ORIGIN and GROUP autofill moment
4. **What are they like?** · three temperament chips
5. **When did they come into your life?** · optional year
6. **Style** · three real examples, not paw prints
7. **Colour and size** · preview updates live
8. **Their photo**

---

## 6. Verify

Alongside the standard build, tests, lint and dash checks:

- Land on `/products/hoodie` with no query string. The form and a garment preview are both
  visible without any interaction.
- Type a name. It appears on the plate within one keystroke.
- Choose Yorkshire Terrier. ORIGIN and GROUP populate without being asked for, and this is
  visible on screen at the same time.
- Change colour. The garment photo changes, the plate does not reload.
- Type `b` in the breed field. Boerboel is first, Labrador is not in the top three.
- Type nothing in the breed field. Six breeds are offered, not thirty-five.
- Choose `Other`. Three named questions appear. The words "Detail" and "Value" appear
  nowhere in the UI.
- Every selected chip is oxblood, not black.
