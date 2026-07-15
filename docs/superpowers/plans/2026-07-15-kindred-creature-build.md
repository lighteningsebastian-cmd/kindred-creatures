# Kindred Creature Co. Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Execution model per owner instruction: Fable 5 is PM/reviewer; each task is dispatched to an Opus subagent which owns implementation and tests within the contracts below.

**Goal:** Premium e-commerce site for AI-customized pet apparel (South Africa, PayFast, local print-on-demand partner) with signature hand-crafted pet animations.

**Architecture:** Next.js App Router on Vercel; server components for all marketing/product pages; client islands for the customizer, cart, and animations. Products/variants are typed code config (4 products, YAGNI); Postgres (Drizzle) stores orders, order items, artworks, and webhook events. All external services (OpenAI images, PayFast, Resend) sit behind interfaces with a mock mode so the entire flow runs locally with zero credentials.

**Tech Stack:** Next.js 15 (App Router) · Tailwind v4 · Motion (`motion/react`) · Drizzle ORM + Postgres (PGlite for dev/test, Neon in prod) · OpenAI gpt-image-1 · PayFast · Resend · Zustand (cart) · @phosphor-icons/react · GA4.

**Spec:** `docs/superpowers/specs/2026-07-15-kindred-creature-ecommerce-design.md`. Amendments from the Taste skill (these override the spec where they conflict):
- Fonts: **Bricolage Grotesque** (display, via `next/font/google`) + **Instrument Sans** (body). No Fraunces, no serif.
- Palette: **Terracotta + Slate** family, NOT cream+espresso.
- Signature animations are explicitly briefed by the owner (hand-crafted SVG characters are authorized for these three components only; all icons still come from Phosphor).

---

## Design System Contract (all tasks must use these tokens)

CSS variables defined in `src/app/globals.css`, exposed to Tailwind v4 via `@theme`:

| Token | Light | Dark |
|---|---|---|
| `--color-base` (page bg) | `#FAFAF8` | `#17191D` |
| `--color-surface` (tinted section/card bg) | `#F0F1EF` | `#1F2227` |
| `--color-ink` (headings/body) | `#23272E` | `#ECEDEA` |
| `--color-muted` (secondary text) | `#5B6470` | `#9AA1AB` |
| `--color-accent` (terracotta) | `#BF5B3B` | `#D96E4A` |
| `--color-accent-deep` (hover) | `#A84D30` | `#C05B3C` |
| `--color-line` (hairlines) | `#E2E4E0` | `#2C3036` |

- **Radius rule (documented, applied everywhere):** interactive controls (buttons, pills, inputs' focus chips) = full pill; cards/images/panels = `16px`; form inputs = `10px`.
- **Type scale:** display `text-4xl md:text-5xl lg:text-6xl tracking-tight`, headlines ≤ 8 words; body `text-base leading-relaxed max-w-[65ch]`, section subtext ≤ 25 words.
- **Motion:** Motion (`motion/react`) only; springs (`type:"spring", stiffness:100, damping:20`) or ease `[0.16,1,0.3,1]`; every animated component honors `useReducedMotion()`; animate only `transform`/`opacity`; no `window.addEventListener("scroll")`; dials VARIANCE 7 / MOTION 7 / DENSITY 3.
- **Theme:** dual light/dark from the start via `prefers-color-scheme` (CSS variables strategy), whole page one theme.
- **Icons:** `@phosphor-icons/react` only, one weight (`regular`) globally.
- **Copy register:** warm, specific, human; zero em-dashes anywhere; no "elevate/seamless/unleash"; ZAR prices formatted `R 549`.
- **Layout:** `max-w-[1400px] mx-auto px-4 md:px-8`; heroes `min-h-[100dvh]` never `h-screen`; nav single line ≤ 72px; max 1 eyebrow per 3 sections; no 3-equal-card feature rows; no centered-hero default (VARIANCE 7 → asymmetric split hero).
- **Images:** real photography via `https://picsum.photos/seed/{descriptive-seed}/{w}/{h}` placeholders in v1, each behind a `<!-- TODO: real photo -->` note; `next/image` everywhere, hero image `priority`.

## Signature Animations Contract (owner's explicit brief)

Three hand-crafted SVG character components in `src/components/creatures/`, each a `"use client"` leaf, each with a static reduced-motion fallback, drawn in a consistent style: single-weight `--color-ink` line art with flat `--color-accent` fill accents (matches the brand, avoids clip-art feel):

1. **`DeliveryDog.tsx`** — a side-view trotting dog carrying a wrapped parcel in its mouth, used in the "Printed and delivered in 5 working days" section. Dog trots in from the left when the section enters the viewport (whileInView, once), legs animate on a loop while visible, tail wags. Parcel has a subtle bob synced to the gait.
2. **`CartDog.tsx`** — wraps the nav cart icon. On hover/focus of the cart button, a dog's head (ears first) rises out of the cart basket, blinks once, and ducks back down on mouse-leave. When an item is added to the cart, the head pops up briefly with a happy ear-perk (triggered via cart-store subscription). Cart count badge sits on the basket rim.
3. **`CatSwat.tsx`** — a cat paw that reaches from the edge of the FAQ section header and bats at the last word of the heading (the word swings on a string like a tag toy, then settles with spring physics). Triggers once per viewport entry; on hover of the heading it swats again.

Rules: these are the ONLY hand-rolled SVGs permitted; they must be genuinely charming (bezier-drawn, not geometric primitives glued together); all loops pause off-viewport (`whileInView` / IntersectionObserver) and under reduced motion render as static art.

## File Structure (locked)

```
src/
  app/
    layout.tsx  page.tsx  globals.css              # shell + home
    products/[slug]/page.tsx                       # product detail + customizer entry
    customize/[slug]/page.tsx                      # customizer flow (client island)
    cart/page.tsx  checkout/page.tsx
    order/[token]/page.tsx                         # confirmation / status lookup
    about/page.tsx  faq/page.tsx  journal/page.tsx
    admin/(dashboard)/...                          # admin (auth-gated)
    api/upload/route.ts  api/generate/route.ts
    api/checkout/route.ts  api/payfast/itn/route.ts
    api/admin/...
    sitemap.ts  robots.ts  llms.txt/route.ts
  components/
    ui/ (Button, Input, Badge, Skeleton, ...)      # design-system primitives
    layout/ (Nav, Footer)
    creatures/ (DeliveryDog, CartDog, CatSwat)
    sections/ (Hero, ProcessSteps, DeliveryPromise, Testimonials, FaqAccordion, ...)
    customizer/ (UploadDropzone, StylePicker, PreviewCanvas, GarmentMockup)
  lib/
    products.ts                                    # typed catalog config (4 products)
    cart-store.ts                                  # Zustand + localStorage persist
    db/schema.ts  db/client.ts                     # Drizzle: orders, order_items, artworks, webhook_events
    images/provider.ts  images/openai.ts  images/mock.ts
    payfast.ts                                     # signature build/verify, redirect payload, ITN validation
    email/send.ts  email/templates/                # Resend + mock transport
    analytics.ts                                   # GA4 event helpers
    seo/jsonld.ts
.env.example
```

Core shared types (defined in Task 3, used verbatim everywhere after):

```ts
// lib/products.ts
export type ProductSlug = "hoodie" | "tee" | "crewneck" | "tote";
export interface Variant { color: string; colorHex: string; sizes: string[]; priceZar: number; }
export interface Product {
  slug: ProductSlug; name: string; blurb: string; variants: Variant[];
  printArea: { widthMm: number; heightMm: number };   // drives print-file sizing at 300 DPI
}

// lib/images/provider.ts
export type ArtStyle = "classic-portrait" | "line-sketch" | "watercolor";
export interface ImageProvider {
  generatePreview(input: { uploadKey: string; style: ArtStyle }): Promise<{ previewKey: string }>;
  generatePrintFile(input: { uploadKey: string; style: ArtStyle; widthPx: number; heightPx: number }): Promise<{ printKey: string }>;
}

// order statuses (db/schema.ts)
export type OrderStatus = "pending" | "paid" | "sent_to_printer" | "printed" | "shipped" | "flagged";
```

Mock mode: `MOCK_SERVICES=true` (default when keys absent) makes `images/mock.ts` return a bundled sample artwork after 2s, `email/send.ts` log to console, and PayFast use sandbox host + a `/api/payfast/itn` simulator script. `.env.example` documents every variable.

---

## Tasks (one Opus subagent each; PM reviews + commits gate each task)

### Task 1: Scaffold + design system + shell
**Create:** Next.js app (TS, Tailwind v4, App Router, `src/`), `globals.css` tokens above, fonts via `next/font/google` (Bricolage Grotesque + Instrument Sans), `components/ui/*` (Button, Input, Badge, Skeleton, Container), `components/layout/Nav.tsx` + `Footer.tsx`, placeholder `page.tsx`, `.env.example`, Vitest + Testing Library setup.
- [ ] Scaffold with `npx create-next-app@latest`, wire tokens/fonts/theme (dual mode via CSS variables)
- [ ] Build ui primitives (pill buttons w/ `:active` scale-[0.98], WCAG AA contrast both modes)
- [ ] Nav (≤72px, single line, logo wordmark, links: Shop, How it works, FAQ; cart button placeholder slot for CartDog) + Footer (contact, policies, no version strings)
- [ ] `npm run build` + `npm test` pass; commit `feat: scaffold app with design system and shell`

### Task 2: Creature animations
**Create:** `components/creatures/DeliveryDog.tsx`, `CartDog.tsx`, `CatSwat.tsx` + a `/dev/creatures` preview page (excluded from sitemap).
- [ ] Implement the three components per the Signature Animations Contract (Motion springs, whileInView gating, reduced-motion static fallback, no layout shift)
- [ ] Integrate CartDog into Nav's cart button
- [ ] Verify in browser at `/dev/creatures` (all three animate, pause off-viewport, static under reduced motion); commit `feat: signature creature animations`

### Task 3: Catalog + product pages
**Create:** `lib/products.ts` (4 products, ZAR prices as config placeholders marked for owner confirmation, real print-area mm), `products/[slug]/page.tsx`, home `page.tsx` full landing.
Landing sections (≥4 distinct layout families, no zigzag x3): asymmetric split hero (lifestyle photo + headline ≤8 words + single CTA "Create theirs"), how-it-works (3 steps, verb labels, not "Step 1"), product grid (4 tiles, varied sizes/bento rhythm with photography), **DeliveryPromise section with DeliveryDog** ("Printed and delivered in 5 working days"), testimonials (≤3 lines each, SA names), FAQ teaser with **CatSwat**.
- [ ] `lib/products.ts` + unit tests (price formatting `R 549`, print-area math helper `printPixels(product) = mm/25.4*300` rounded)
- [ ] Landing page per section list; product pages with color/size selection (server page + small client island), garment photos per color (picsum seeds), CTA into `/customize/[slug]`
- [ ] Pre-flight pass (eyebrow count, no em-dashes, hero fits viewport, CTA intent unique); build + tests green; commit `feat: catalog and landing`

### Task 4: Customizer
**Create:** `customize/[slug]/page.tsx`, `components/customizer/*`, `api/upload/route.ts`, `api/generate/route.ts`, `lib/images/*`, `lib/db/*` (schema incl. `artworks`), storage adapter (`lib/storage.ts`: local `.data/` in dev, Vercel Blob in prod).
Flow: upload photo (drag-drop, client-side downscale to ≤2048px, jpeg/png/heic) → moderation (OpenAI moderation in real mode, pass-through mock) → pick 1 of 3 styles → preview generation (low-res 512px, watermark "kindred creature co." tiled at 12% opacity) → composite onto garment mockup (CSS transform onto print-area box of the product photo) → 3 regenerations max per upload (server-enforced on artwork row) → "Add to cart" stores `artworkId`.
- [ ] Drizzle schema + migrations (PGlite dev/test, `DATABASE_URL` prod); `artworks`: id, uploadKey, style, previewKey, printKey, regenCount, status, createdAt
- [ ] Upload + generate routes with mock provider (2s delay, bundled sample art per style) and OpenAI gpt-image-1 provider behind `ImageProvider`
- [ ] Customizer UI with loading skeletons (shaped like final preview), error states (moderation rejection copy is friendly), regen counter
- [ ] Tests: provider mock, regen limit enforcement, print-pixel sizing; build green; commit `feat: AI customizer with mock and openai providers`

### Task 5: Cart + checkout + PayFast
**Create:** `lib/cart-store.ts`, `cart/page.tsx`, `checkout/page.tsx`, `api/checkout/route.ts`, `lib/payfast.ts`, `api/payfast/itn/route.ts`, `order/[token]/page.tsx`, `lib/email/*`, db tables `orders`/`order_items`/`webhook_events`.
- [ ] Cart store (Zustand persist): items {productSlug, color, size, qty, artworkId, unitPriceZar}; Nav badge + CartDog pop on add
- [ ] Checkout: shipping form (labels above inputs, error text below, SA provinces), creates `pending` order server-side with server-computed totals, returns signed PayFast redirect payload (sandbox host in mock mode)
- [ ] ITN webhook: verify signature + merchant id + amount; idempotent via `webhook_events` unique payfastPaymentId; `pending→paid`; never trust the browser return URL
- [ ] Order confirmation page via signed token (HMAC of orderId); confirmation email (mock logs); simulator script `scripts/simulate-itn.ts` for local testing
- [ ] Tests: signature build/verify vectors, idempotency (same ITN twice → one transition), amount-mismatch rejection, total computation; commit `feat: cart, checkout, and PayFast integration`

### Task 6: Fulfillment + admin
**Create:** `admin/*` (Auth.js credentials, single admin user from env), post-payment pipeline in ITN handler, `lib/email/templates/job-sheet.tsx`, flagged queue.
- [ ] On `paid`: enqueue high-res print-file generation (print-area px at 300 DPI); success → job-sheet email to `PRINT_SHOP_EMAIL` with signed download URLs + order details, customer confirmation; failure → status `flagged` (no job sheet sent)
- [ ] Admin dashboard: order table (status, customer, items, artwork thumbnails), status transitions (`paid→sent_to_printer→printed→shipped`), tracking-number input (sends shipping email), re-send job sheet, flagged queue with retry-generation
- [ ] Tests: state-transition guards, flag-on-failure path, job-sheet renders order data; commit `feat: fulfillment pipeline and admin dashboard`

### Task 7: SEO, analytics, polish
**Modify:** all pages. **Create:** `sitemap.ts`, `robots.ts`, `llms.txt` route, `lib/seo/jsonld.ts`, `lib/analytics.ts`, `about/page.tsx`, `faq/page.tsx`, `journal/page.tsx` (scaffold), OG images.
- [ ] Metadata + canonical per page; JSON-LD: Organization, Product(+Offer ZAR), FAQPage, HowTo, BreadcrumbList; answer-shaped FAQ copy ("custom pet hoodie South Africa" etc.)
- [ ] GA4: gtag loader (env-gated) + events view_item, add_to_cart, begin_checkout, purchase (server-confirmed page), photo_uploaded, art_generated, art_regenerated
- [ ] Full Taste pre-flight checklist on every page (mechanical: em-dash grep, eyebrow count, contrast, both themes, reduced motion); Lighthouse ≥90 perf/SEO on home + product; copy self-audit; commit `feat: seo, analytics, and launch polish`

---

## Review gates (PM runs after every task)
1. `npm run build && npm test` green; 2. browser check via preview server (both themes, mobile 375px); 3. Taste pre-flight spot check (em-dash grep `grep -rn "—" src/`, eyebrow count, banned tells); 4. spec-conformance skim; then commit and dispatch next task.
