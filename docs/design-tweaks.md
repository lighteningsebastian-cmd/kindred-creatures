# Design tweaks backlog (do AFTER architecture is complete)

Owner feedback, 2026-07-17. Do not action these until the build is functionally complete;
batch them into one pass.

**Status (2026-07-17): items 1, 2, 4, 5 DONE (commits 19f8424, f01b85f, c457e2b, c6223b6).**
Item 3 is the same concern as item 5 (palette), resolved by making the storefront
light-only. Remaining: item 6 (merge product + customizer flow, a design decision + build),
item 7 (embroidery, blocked on print partner), item 8 (sayings, needs exploration), plus
real photography. Motion smoothness of the revised cat and cart dog still wants one eyeball
on a real browser (the preview pane throttles animation frames).

## 1. CatSwat: the cat is not visible  [DONE f01b85f]
Currently you only see the FAQ heading word wobble. The swat reads as a wobble, not as a
cat. Fix: make the cat actually visible and legible as a cat. Options: bring more of the
cat in from the edge (head + shoulder + foreleg, not just a paw), enlarge it, slow the
retreat so the eye catches it, and/or have it linger before withdrawing. The swing is
nice and should stay; the cat needs to be seen doing it.

## 2. CartDog: too small to read as a dog  [DONE c457e2b]
The head that rises above the cart basket is too small to recognise. Fix: have it emerge
further above the rim (more of the head/neck), and enlarge the head relative to the
basket, while keeping the nav button box fixed (no layout shift, overflow visible).

## 3. Palette is too dark; lighten toward the Claude Design kit  [DONE 19f8424, same as item 5]
The rendered site reads darker than the handed-over kit. Re-check against
`design/DESIGN-SYSTEM.md` and the kit itself (`design/kindred-creatures-ui-kit.html`),
and lighten so it matches. Suspects: bark ink on parchment feels heavy; the maroon utility
bar and oxblood may be rendering darker than intended; dark-theme inversion may be
bleeding into perception of the light theme. Verify actual computed colors against the
kit's `:root` values rather than eyeballing.

## 4. Footer email does not match the brand name  [DONE c6223b6]
Footer shows `hello@kindredcreature.co.za` (singular) but the brand is Kindred Creatures.
Settle the real address and domain, then make it consistent everywhere.

> Done (2026-07-17): footer, `BRAND_EMAIL` and the email layer now all use the plural
> `hello@kindredcreatures.co.za`. NOTE: the real domain (`kindredcreature.co.za` vs
> `kindredcreatures.co.za`, and whether it is registered) still needs owner confirmation
> before launch; `NEXT_PUBLIC_SITE_URL` in `.env.example` is left as-is pending that call.

## 5. Palette: go light for the shopping experience  [DONE 19f8424 - storefront now light-only]
Owner viewed the site and restated that it is too dark. Important context: the Claude
Design kit **ships light only** (it is an editorial paper brand). The dark theme was added
by the earlier Taste-skill pass, which mandates dual-mode by default; it is not in the kit.

**Recommended resolution (needs owner confirmation): make the storefront light only** and
drop the dark inversion, so the site always matches the kit. Simply lightening the dark
theme would still leave dark-system-preference visitors seeing a palette the brand never
designed. Admin may keep dual-mode (internal tool, not brand surface).
Also re-verify the light theme's computed values against the kit's `:root` tokens: the
owner has now called it dark twice, so check the actual rendered hexes rather than trusting
the token names.

## 6. Product page should flow straight into the portrait
Owner: clicking the hoodie should automatically surface "choose the colour" and "choose the
size", and then the portrait step should come up automatically so they upload their photo.

Today: `/products/[slug]` has colour + size + a CTA that navigates to `/customize/[slug]`.
The customizer then repeats the colour/size context. That is one click and one page too
many, and the repetition reads as a false start.

Fix direction (needs a design decision, not a blind merge): collapse product and customizer
into one continuous flow so choosing colour and size reveals the upload step in place.
Watch out for: the product page is the SEO landing page and must stay server-rendered and
indexable, while the customizer is a client island; and `/customize/[slug]?color=&size=`
is currently a real entry point. Keep an indexable product URL.

## 7. Embroidery upsell (+R150) — NOT a tweak, a feature
Owner wants an option to have the portrait **embroidered instead of printed**, for an extra
R150. This is an architecture change, not a visual one. It touches:
- `products.ts` (a per-item finish option, priced), the cart item shape, `order_items`,
  and server-side price re-derivation in `/api/checkout` (the tampering guard must cover it).
- The **job sheet**: the print shop must be told clearly that a line is embroidered, not
  printed. This is the part that costs real money if it is wrong.
- **The print file itself.** Embroidery does not use a 300 DPI PNG; it needs a digitised
  stitch file (DST/PES/EXP) or the shop digitises from artwork. Our whole `printPixels`
  pipeline assumes print. Do not pretend a PNG is an embroidery file.
**Blocked on the print partner:** confirm they embroider at all, what file they need, their
cost, and the turnaround (embroidery is usually slower than the advertised 5 working days).
Get that before building, or we will build the wrong pipeline.

## 8. Sayings / slogan range — needs exploration first
Owner wants shirt options carrying sayings, and explicitly flagged the tone risk: **premium
brand, so not "cute"**. Owner asked for this to be explored rather than assumed.

Open questions to resolve before any build: are sayings standalone designs, or combined
with a pet portrait? Are they a fixed curated set (on-brand, art-directed, protects the
premium feel) or customer-entered free text (which invites profanity, trademark, and
typesetting problems and is a moderation surface we would own)? What is the typographic
treatment: Young Serif at scale is the brand's strongest asset and could carry a saying
beautifully. Tone reference: dry, warm, specific, understated. Not slogan-mug humour.
Recommend a curated set for v1, designed as typography, not clip art.

## Note: the three portrait styles already exist
Owner reconfirmed wanting classic portrait, line sketch, and watercolor. These are already
built and working in the customizer (`StylePicker`, and the mock provider returns a
distinct sample per style). No work needed beyond art direction of the real outputs once
the OpenAI key is in.

## Also outstanding (not owner-raised, known)
- All photography is placeholder (picsum stock). Real product + lifestyle shots needed.
- Animation smoothness unverified: the preview pane throttles animation frames, so the
  dog trot, cart pop, and scroll reveals need one pass on a normal browser.
