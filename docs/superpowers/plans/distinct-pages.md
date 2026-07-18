# Distinct pages: Home, Shop, How it works

**Problem:** "Shop" and "How it works" in the nav are anchors (`/#range`,
`/#how-it-works`) that scroll the home page. There are no `/shop` or
`/how-it-works` routes, so all three "pages" are the same page. Confirmed by the
owner as the thing to fix.

**Decision (owner):** make Shop and How-it-works real, distinct pages; Shop is a
merchandised catalogue; How-it-works is a full trust page. Home becomes the
funnel that links out to them.

**Distinctiveness guardrail:** each page uses a different primary layout family
so they do not read as reskins:
- **Home** = asymmetric editorial funnel (hero + varied teaser sections).
- **Shop** = product-card catalogue grid (merchandising, minimal storytelling).
- **How it works** = numbered vertical process + showcases (long-form, step-driven).

Keep the design system unchanged: parchment light palette, Young Serif + Archivo,
oxblood accent, near-square radii, eyebrows on left-aligned sections, the two-line
`AccentRule` for centered moments, the delivery dog. Reuse existing components and
data (`products.ts`, `lib/content.ts`, `StylePicker` copy, `AccentRule`, `Reveal`,
`Button`, `Container`). Zero em/en-dashes; middot allowed. Both-nothing: no fake
reviews/ratings. Real photography stays placeholder (picsum) with TODO notes.

Build as sections, one agent each, commit per section (interruptions are common).

---

## P1. Wire the new routes into navigation + home teasers  [pending]
Prep so the pages have somewhere to be linked from. Small.
- **Nav** (`src/components/layout/Nav.tsx`): repoint "Shop" -> `/shop`,
  "How it works" -> `/how-it-works` (both currently `/#...`). Keep "Our story"
  (`/about`) and "FAQ" (`/faq`).
- **Footer** (`src/components/layout/Footer.tsx`): same repoint for its Shop and
  How it works links.
- **Home teasers:** keep the home `ProductRange` and `HowItWorks` sections but
  add a trailing link on each: ProductRange gets "See the whole range" -> `/shop`;
  HowItWorks gets "See how it works" -> `/how-it-works". These sections keep their
  `id="range"` / `id="how-it-works"` so existing anchor links still resolve (no
  redirect needed).
- Placeholder pages: create minimal `src/app/shop/page.tsx` and
  `src/app/how-it-works/page.tsx` (heading + "coming in the next step") ONLY if
  needed to keep the nav from 404ing between sections; P2/P3 replace them. If P2/P3
  land in the same working session, skip the placeholders.
- Verify build/test/lint. **Commit:** `feat: route shop and how-it-works, link home teasers`.
- **Done when:** nav and footer Shop / How it works go to real routes; home range
  and how-it-works sections each link out; no nav item 404s.

## P2. Shop page — merchandised catalogue  [pending]
`src/app/shop/page.tsx` (server component) + section components in
`src/components/shop/`. Layout must NOT reuse the home ProductRange tile layout
wholesale; it is a larger, catalogue-first composition.
- **Header:** eyebrow "The range" + Young Serif heading (e.g. "Four canvases for
  your creature") + one short intro line. Left-aligned editorial.
- **Product grid:** the four products from `products.ts`, each a LARGE card:
  product image (picsum flatlay seed per product, TODO real photo), name,
  `from R X` via `formatZar` (min variant price), colour dots from `variants[].colorHex`,
  a one-line blurb, and a primary CTA "Personalise" -> `/products/[slug]`. Bigger
  and more generous than the home teaser tiles; 2-up on desktop, 1-up mobile, with
  rhythm (not four identical small tiles).
- **Start-from-a-photo band:** a secondary block "Not sure where to start? Upload
  a photo and see it first" -> CTA to `/customize/hoodie` (a sensible default),
  with the 5-working-days / printed-in-Cape-Town reassurance line.
- **SEO:** metadata + canonical; JSON-LD `CollectionPage` or `ItemList` of the four
  products (name, url, price in ZAR) via a builder in `src/lib/seo/jsonld.ts`
  (extend it; NO fake ratings). Register `/shop` in `src/app/sitemap.ts` (uncomment
  the seam; `sitemap.test.ts` requires the page file to exist).
- Tests: page renders the four products with prices and links; ItemList JSON-LD
  carries ZAR + correct count; sitemap includes `/shop`.
- **Commit:** `feat: shop catalogue page`.
- **Done when:** `/shop` shows a merchandised four-product catalogue distinct from
  the home range section, each product links to its product page, and it is in the
  sitemap with valid structured data.

## P3. How it works page — full trust page  [pending]
`src/app/how-it-works/page.tsx` (server) + components in
`src/components/how-it-works/`. Long-form, step-driven; distinct from both others.
- **Header:** eyebrow "How it works" + heading + short intro.
- **Numbered process (4 steps):** big numbered blocks alternating image / text
  (reuse the alternation cap: vary it, not four identical rows):
  1. Upload a photo. Pick the one that captures them best.
  2. We draw the portrait. Our portrait process turns it into artwork in your
     chosen style. (Frame the process as human and considered; never "AI-generated".)
  3. You approve it. Nothing prints until you say yes; revisions until it is right.
  4. We print and ship. Printed in Cape Town, couriered, 5 working days.
  Camel numerals (varsity block) for the step numbers, consistent with the kit.
- **Styles showcase:** the three styles (classic portrait, line sketch, watercolour)
  as cards with a sample image (picsum/TODO) and the one-line descriptions already
  in the customizer `StylePicker`. Reuse that copy; do not fork it (consider lifting
  the style descriptions into `lib/content.ts` so both read one source).
- **Trust / quality section:** printed in South Africa, approval-before-print,
  premium blanks, 5 working days, real contact. Use the `AccentRule` as a centered
  moment here.
- **Process FAQ:** reuse the relevant entries from `lib/content` FAQS (photo quality,
  revisions, turnaround); emit `FAQPage` JSON-LD via existing `buildFaqPage`.
- **Closing CTA band:** `AccentRule` + a centered "Ready to start their portrait?"
  + primary CTA -> `/customize/hoodie` (or `/shop`).
- **SEO:** metadata + canonical; `HowTo` JSON-LD via existing `buildHowTo`;
  `FAQPage` for the FAQ. Register `/how-it-works` in `sitemap.ts`.
- Tests: page renders the four steps, three styles, and the FAQ; HowTo + FAQPage
  JSON-LD present; sitemap includes `/how-it-works`.
- **Commit:** `feat: how it works trust page`.
- **Done when:** `/how-it-works` is a long-form step-driven trust page distinct from
  home and shop, with HowTo + FAQ structured data, in the sitemap.

---

## After P3
- Optional: trim the home `HowItWorks` teaser to a lighter 3-step summary now that
  the full version has its own page (keep it a teaser, not a duplicate).
- Real photography pass (all product/lifestyle images are still picsum placeholders).
- Verify each page in a real browser for layout distinctiveness (the preview pane
  throttles scroll-reveal, so section content past the fold needs an owner eyeball).
