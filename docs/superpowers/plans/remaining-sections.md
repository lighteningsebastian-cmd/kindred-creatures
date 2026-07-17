# Remaining build: sectioned execution

**Why sections:** agents were repeatedly cut off mid-task by session limits and connection
drops, losing in-flight work. Each section below is small enough for one agent to finish
in a single run and ends in its own commit. A cut-off loses at most one small section, and
work resumes at a precise, known point. One agent per section, sequential (never parallel:
same repo, conflicts).

**Rule for every section:** read `design/DESIGN-SYSTEM.md` first; verify with
`npm run build && npm test && npm run lint` plus `grep -rn "—\|–" src/ --include=*.tsx
--include=*.ts` (must return nothing); commit with trailer
`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`; report status.

**Design tweaks are deferred.** See `docs/design-tweaks.md`. Do not action them in these
sections.

---

## S1. Finish customizer UI  [status: DONE 50d2e70]
Components exist and are uncommitted: `src/components/customizer/{Customizer,UploadDropzone,
StylePicker,PreviewStage,GarmentMockup,downscale}.tsx`, `src/lib/pending-cart.ts`.
Missing: `src/app/customize/[slug]/page.tsx` (server shell: validate slug via `getProduct`,
`notFound()` on bad slug, read `?color=&size=`, render `<Customizer>`), a test for the
orchestrator's state machine (idle → uploading → generating → ready; regen cap disables),
then verify + commit.
**Commit:** `feat: customizer flow ui`
**Done when:** `/customize/hoodie?color=Stone&size=M` runs the full mock flow end to end.

## S2. Cart store + cart page  [status: DONE 572328e]
`src/lib/cart-store.ts` (Zustand + localStorage persist). Item shape:
`{ productSlug, color, size, qty, artworkId, unitPriceZar }`. Replace the
`src/lib/pending-cart.ts` stub (delete it; migrate its call site in `Customizer.tsx`).
`src/app/cart/page.tsx`: line items with artwork thumbnail, qty stepper, remove, totals in
ZAR via `formatZar`, empty state, CTA to `/checkout`. Wire the nav cart badge to the store
count so `CartDog` pops on add.
**Commit:** `feat: cart store and cart page`
**Done when:** add from customizer → badge increments and dog pops → cart shows the line.

## S3. Orders schema + checkout form  [status: DONE 632a8c3]
Extend `src/lib/db/schema.ts`: `orders` (id, status enum
`pending|paid|sent_to_printer|printed|shipped|flagged`, email, shipping fields, subtotalZar,
shippingZar, totalZar, payfastPaymentId nullable, trackingNumber nullable, createdAt),
`order_items` (id, orderId, productSlug, color, size, qty, unitPriceZar, artworkId),
`webhook_events` (id, payfastPaymentId unique, receivedAt, raw).
`src/app/checkout/page.tsx`: shipping form (labels above inputs, errors below, SA
provinces), `POST /api/checkout` creates a `pending` order with **server-computed totals**
(never trust client prices; re-derive from `products.ts`).
**Commit:** `feat: orders schema and checkout`
**Done when:** submitting checkout creates a pending order with correct server-side totals.

## S4. PayFast signature + redirect  [status: DONE 077da2a]
`src/lib/payfast.ts`: signature generation (URL-encoded, sorted per PayFast spec, optional
passphrase), redirect payload builder, sandbox vs live host by env, ITN signature +
merchant-id + amount verification helpers. Unit tests with fixed vectors (build a known
signature; verify a good payload passes and a tampered amount fails). No network calls in
tests. `POST /api/checkout` returns the signed redirect payload.
**Commit:** `feat: payfast signature and redirect payload`
**Done when:** signature vectors pass and tampering is rejected.

## S5. ITN webhook + confirmation  [status: DONE 4cd5020]
`src/app/api/payfast/itn/route.ts`: verify signature, merchant id, and amount against the
order; idempotent via `webhook_events.payfastPaymentId` unique (same ITN twice → one
transition); `pending → paid` only from a verified ITN, never from the browser return URL.
`src/app/order/[token]/page.tsx`: confirmation/status via signed token (HMAC of orderId
using `ORDER_TOKEN_SECRET`). `scripts/simulate-itn.ts` to exercise it locally.
**Commit:** `feat: payfast itn webhook and order confirmation`
**Done when:** simulated ITN flips the order to paid; replaying it changes nothing.

## S6. Email layer  [status: DONE dd4eef5]
`src/lib/email/send.ts` (Resend in prod, console-logging mock when `MOCK_SERVICES`),
templates in `src/lib/email/templates/`: customer order confirmation, shipping
notification, and the print-shop **job sheet** (order number, product/size/colour/qty,
customer shipping details, signed download links for print files). Tests render templates
with order data.
**Commit:** `feat: transactional email layer`
**Done when:** mock transport logs a correct job sheet for an order.

## S7. Print-file pipeline + flagged queue  [status: DONE f1bd76e]
On `paid`: generate the high-res print file via `provider.generatePrintFile` at
`printPixels(product)` (300 DPI), store it, set `artworks.printKey`; on success send the
job sheet + customer confirmation and move to `sent_to_printer`; on failure set order
status `flagged` and send NO job sheet. Retry entry point for admin.
**Commit:** `feat: post-payment print file pipeline`
**Done when:** paid order produces a print file and job sheet; a forced failure flags it.

## S8. Admin auth + dashboard  [status: DONE 75d8765, 651f72c]
Auth.js credentials, single admin from `ADMIN_EMAIL`/`ADMIN_PASSWORD_HASH`, all `/admin`
routes gated. `src/app/admin/`: order table (status, customer, items, artwork thumbnails),
status transitions `paid → sent_to_printer → printed → shipped` with guards (no illegal
jumps), tracking-number input (triggers shipping email), re-send job sheet, flagged queue
with retry-generation. Tests for transition guards.
**Commit:** `feat: admin dashboard and fulfillment controls`
**Done when:** admin can move an order through the states and retry a flagged one.

## S9. SEO foundations  [status: pending]
Per-page metadata + canonicals; JSON-LD in `src/lib/seo/jsonld.ts` (Organization, Product
with ZAR offers, FAQPage, HowTo, BreadcrumbList); `sitemap.ts`, `robots.ts`, `llms.txt`
route. Exclude `/dev/*` and `/admin/*` from indexing.
**Commit:** `feat: seo metadata, structured data, and sitemap`

## S10. Analytics + remaining pages  [status: pending]
`src/lib/analytics.ts`: GA4 gtag (env-gated via `NEXT_PUBLIC_GA_MEASUREMENT_ID`) with
`view_item`, `add_to_cart`, `begin_checkout`, `purchase` (fired on the server-confirmed
order page), plus `photo_uploaded`, `art_generated`, `art_regenerated`. Build the
`/about` ("Our story"), `/faq` (answer-shaped, targets "custom pet hoodie South Africa"),
and `/journal` scaffold pages that the nav already links to.
**Commit:** `feat: analytics and remaining pages`

---

## Known issues (not blocking, fix when convenient)

**Test DB isolation.** The suite has twice failed 5 files on the first run immediately
after a subagent finished, then passed 265/265 on every subsequent run, including with a
cleared vite cache. No stray processes remain at that point. The likely cause is that tests
share the dev PGlite data directory (`.data/pgdata`) rather than using an isolated or
in-memory database, so they contend when a dev server holds it open. It is a test-isolation
smell, not a product defect, but it makes the suite untrustworthy exactly when it matters
(the money path). Fix: give tests their own ephemeral PGlite instance per run.

## After S10
Design-tweaks pass (`docs/design-tweaks.md`), real photography, then launch checklist:
Lighthouse, both themes, mobile, and the owner-supplied items (PayFast credentials, OpenAI
key, print shop details, domain, pricing).
