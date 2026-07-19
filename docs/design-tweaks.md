# Design tweaks backlog (do AFTER architecture is complete)

Owner feedback, 2026-07-17. Do not action these until the build is functionally complete;
batch them into one pass.

**Status (2026-07-19): items 2, 4, 5 DONE (commits c457e2b, c6223b6, 19f8424); item 6
DONE (commit 59ef6d6 for the merged flow, plus this commit for the redirect + cleanup).**
Item 3 is the same concern as item 5 (palette), resolved by making the storefront
light-only. Remaining: item 7 (embroidery, blocked on print partner), item 8 (sayings,
needs exploration), plus real photography. Cart-dog motion smoothness still wants one
eyeball on a real browser (the preview pane throttles animation frames).

## 1. Cat swat animation: REMOVED (owner decision, 2026-07-17)
The swatting-cat idea by the FAQ heading was tried several times (paw-only, then a
side-profile reaching cat, then a chibi cat peeking over the heading) and never looked
good enough for a premium brand. The owner decided to delete it entirely rather than keep
iterating. The `CatSwat` component, its test, and all usages were removed; the FAQ teaser
now uses a plain eyebrow + heading. Do NOT rebuild a cat animation unless the owner
explicitly revisits it with a new approach in mind. The delivery dog and cart dog stay.

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

## 6. Product page should flow straight into the portrait  [DONE 59ef6d6 + this commit]
Owner: clicking the hoodie should automatically surface "choose the colour" and "choose the
size", and then the portrait step should come up automatically so they upload their photo.

Was: `/products/[slug]` had colour + size + a CTA that navigated to `/customize/[slug]`.
The customizer then repeated the colour/size context. That was one click and one page too
many, and the repetition read as a false start.

Done: product and customizer are now one continuous flow on `/products/[slug]`. A
`ProductFlow` client island lifts colour/size state and feeds both a controlled
`ProductConfigurator` (top) and the portrait `Customizer` (below). Choosing a colour and
size activates the portrait step in place and smooth-scrolls it into view (reduced-motion:
enable, no scroll); before that the step is present but disabled, so the page never jumps.
The artwork lives in the Customizer, so switching colour/size after a portrait exists keeps
the art and updates the mockup live, and the cart line is built from the current selection.
`/customize/[slug]` is now a permanent (308) redirect into `/products/[slug]` preserving
`?color=&size=` (bad slug still 404s); the shop band and how-it-works CTA point at
`/products/hoodie`. All customizer behaviour (moderation copy, server-enforced 3-regen cap
with a UI counter, skeleton loading, watermarked preview, add-to-cart gating, cart-dog pop,
routing to /cart) and every analytics event are preserved; the API contracts are untouched.

Note: reading `?color=&size=` on the server makes `/products/[slug]` render on demand
rather than at build time. It stays a server component, fully server-rendered and indexable
(canonical URL carries no params), with its metadata, JSON-LD and generateStaticParams
intact.

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
