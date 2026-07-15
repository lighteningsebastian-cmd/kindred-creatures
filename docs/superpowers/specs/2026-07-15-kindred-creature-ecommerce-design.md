# Kindred Creature Co. — Design Spec

**Date:** 2026-07-15
**Status:** Approved by owner (Sebastian)
**Working title / brand:** Kindred Creature Co. (domain target: kindredcreature.co.za — verify availability before launch)

## 1. What we're building

A premium e-commerce site for custom pet apparel in South Africa. Customers upload a photo of their pet (dog, cat, lizard, anything), an AI pipeline turns it into stylized portrait artwork, and the artwork is printed on garments by a local print-on-demand partner. We hold no stock and do no printing.

**Brand mandate:** premium feeling and trust. Although AI powers the image transformation, the site must not *look* AI-generated — it must feel genuine and human. The AI is framed as "our portrait process," never as the product's hero.

## 2. Decisions already made

| Decision | Choice |
|---|---|
| Market | South Africa first (ZAR) |
| Payments | PayFast (redirect checkout + ITN webhook): cards, Instant EFT, SnapScan, Zapper |
| Fulfillment | A specific local print shop; **v1 = automated order feed via email**, no printer login (that's v2) |
| AI images | OpenAI gpt-image-1, behind a swappable provider interface |
| Products v1 | Hoodies, T-shirts, sweatshirts/crewnecks, tote bags |
| Stack | Next.js (App Router) on Vercel, Postgres (Neon) + Drizzle, object storage for images, Resend for email |
| Analytics | Google Analytics 4 with full e-commerce events |
| SEO | Traditional SEO + AI SEO (GEO/AEO): SSR, JSON-LD, llms.txt, answer-shaped content |
| Build model | Fable 5 acts as PM; Opus subagents implement in phases |

## 3. Brand & design language

- **Palette:** warm cream/off-white base, deep warm charcoal for text, one earthy accent (terracotta/clay). No gradients, no glassmorphism, no purple, no sparkle/AI visual tropes.
- **Type:** characterful display serif (Fraunces) for headings; quiet humanist sans for body.
- **Imagery:** real lifestyle photography of pets and owners is the backbone; subtle hand-drawn/stitched detail elements; generous whitespace.
- **Voice:** warm, specific, first-person-plural; copy is about *their* pet and the human–animal bond. Trust signals: clear pricing, local printing story, real process explanation, returns policy, contact details.

## 4. Customer flow

1. **Browse:** product pages for hoodie / tee / crewneck / tote with color and size options, ZAR pricing.
2. **Customize:** upload pet photo → automated moderation check → gpt-image-1 generates a stylized portrait in a chosen art style (launch with 2–3 styles, e.g., classic oil portrait, line sketch, watercolor). Preview is **low-res and watermarked** to control cost; 3 free regenerations per uploaded photo.
3. **Mockup:** generated art composited live onto the selected garment/color.
4. **Checkout:** cart → PayFast redirect → customer pays → PayFast ITN webhook confirms payment server-side.
5. **Post-payment:** high-res print-ready file (300 DPI PNG sized to the product's print area) is generated and stored. Only paid orders incur high-res generation cost.
6. **Fulfillment handoff:** print shop automatically receives a job-sheet email per order: order number, product/size/color/quantity, customer shipping details, and secure download links for print files.
7. **Notifications:** customer receives order confirmation, then a shipping notification (with tracking number if provided) when the order is marked shipped in admin.

No customer accounts in v1. Order lookup via emailed link with a signed token.

## 5. Admin dashboard (owner-facing)

Password-protected (single admin credential via Auth.js or equivalent):
- Order list with statuses: `paid → sent_to_printer → printed → shipped` (plus `flagged` for failures).
- View each order's generated art and print files; re-send job-sheet emails.
- Add tracking numbers (triggers customer shipping email).
- Flagged-order queue: anything that failed post-payment processing appears here instead of silently stalling.

**v2 (out of scope for v1):** dedicated print-shop login with order queue and status updates by the printer.

## 6. Architecture

- **App:** Next.js App Router, deployed on Vercel. Server components for all marketing/product pages (SEO). Route handlers for API endpoints (upload, generate, checkout, webhooks, admin).
- **Data:** Postgres on Neon, Drizzle ORM. Core tables: `products`, `variants` (color/size/price/print-area), `orders`, `order_items`, `artworks` (upload ref, style, preview ref, print-file ref, generation status), `webhook_events` (idempotency).
- **Storage:** object storage (Cloudflare R2 or Vercel Blob) with private buckets; downloads via time-limited signed URLs. Buckets/prefixes: raw uploads, previews, print files.
- **AI pipeline:** `ImageProvider` interface (`generatePreview`, `generatePrintFile`) with an OpenAI gpt-image-1 implementation. Moderation on upload before any generation. Provider swappable later (Gemini/Replicate).
- **Payments:** PayFast integration — signature-generated redirect form; ITN webhook handler that verifies signature, source IP, and amount, and is idempotent (dedupe on PayFast payment ID via `webhook_events`).
- **Email:** Resend — customer transactional emails + print-shop job sheets, both from branded templates.
- **Analytics:** GA4 via gtag with e-commerce events: `view_item`, `add_to_cart`, `begin_checkout`, `purchase` (fired server-confirmed), plus custom events for the customizer funnel (`photo_uploaded`, `art_generated`, `art_regenerated`).

## 7. SEO & AI SEO

- Server-rendered pages, per-page titles/meta/OG images, canonical URLs.
- JSON-LD: `Organization`, `Product` (with offers in ZAR), `FAQPage`, `HowTo` (the customization process), `BreadcrumbList`.
- `sitemap.xml`, `robots.txt`, `llms.txt`.
- Answer-shaped FAQ and process content targeting queries like "custom pet hoodie South Africa", "put my dog on a hoodie" — written so AI assistants can cite the brand.
- Fast Core Web Vitals: optimized images (`next/image`), minimal client JS on marketing pages.
- Blog scaffold (`/journal`) for future content; not populated in v1 beyond structure.

## 8. Error handling & edge cases

- **Failed AI generation (preview):** doesn't consume a regeneration credit; user prompted to retry or re-upload.
- **Moderation rejection:** friendly message, no generation attempted.
- **Failed high-res generation after payment:** order flagged in admin; job-sheet email held until resolved; owner can retry generation from admin.
- **PayFast webhook:** signature + amount + merchant ID verification; unknown or duplicate payment IDs logged and ignored; orders only transition to `paid` from a verified ITN, never from the browser redirect alone.
- **Abandoned customizations:** artwork records without orders are garbage-collected after 30 days.
- **Cost control:** previews low-res + watermarked; regeneration cap; high-res only post-payment.

## 9. Testing

- Unit tests for: PayFast signature generation/verification, ITN idempotency, print-file sizing math, order state transitions.
- Integration tests for the checkout API and webhook handler (PayFast sandbox).
- The AI provider is mocked in tests; one manual smoke test per style against the real API before launch.
- Lighthouse/SEO checks on key pages as part of the final phase.

## 10. Build phases (Opus subagents, Fable 5 as PM)

1. **Scaffold + design system** — Next.js project, Tailwind theme (palette/type above), layout, core components.
2. **Product catalog & pages** — data model, seed products, product/landing/about/FAQ pages.
3. **AI customizer** — upload, moderation, gpt-image-1 preview pipeline, mockup compositing, regeneration limits.
4. **Checkout & PayFast** — cart, order creation, redirect checkout, ITN webhook, order confirmation email.
5. **Fulfillment & admin** — high-res print pipeline, job-sheet emails, admin dashboard, status flow, shipping notifications.
6. **SEO, analytics & polish** — GA4 events, JSON-LD, sitemap/llms.txt, performance pass, copy polish, launch checklist.

Each phase is reviewed by the PM before the next begins.

## 11. Out of scope for v1

- Printer-facing login/portal (v2).
- Customer accounts.
- International shipping/currency; Stripe.
- Additional products (mugs, pet bandanas, etc.).
- Populated blog content.
- Discount codes / gift cards.

## 12. Open items (non-blocking, needed before launch)

- Confirm domain availability and register.
- Print shop: confirm blank garment catalog (brands, colors, sizes), print areas/dimensions per product, per-unit print costs, shipping method/costs, and the email address for job sheets.
- PayFast merchant account credentials (merchant ID, key, passphrase).
- OpenAI API key + budget; GA4 property; Resend account + sending domain.
- Retail pricing per product (needs print-shop cost inputs).
- Returns/refunds policy text (custom goods — typically no returns except defects; must be stated clearly for trust).
