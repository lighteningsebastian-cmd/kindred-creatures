# HANDOVER: Kindred Creatures — read this first in a fresh session

Premium South African e-commerce for custom pet-portrait apparel. Customer uploads a pet
photo -> AI draws a portrait (framed as "our portrait process", NEVER "AI-generated" in
copy) -> printed on hoodie/tee/crewneck/tote by a Jeffreys Bay print shop -> couriered in
7 to 10 working days. ZAR, PayFast. No stock held; fulfilment is job-sheet emails to the
printer. (Copy pass 27 Jul 2026: location is Jeffreys Bay by name, suppliers never named
on customer surfaces; delivery promise is the wide "7 to 10 working days" on transactional
surfaces and "about five working days" only on the how-it-works flow + DeliveryPromise,
via `DELIVERY_WINDOW` in `src/lib/content.ts`; free shipping threshold is R1000.)

## Operating model (how this project is run)
- The assistant acts as PM; implementation is dispatched to Opus subagents, ONE at a time
  (same repo, never parallel), each given a small section that ends in a commit, and told
  to commit each logical chunk WITHIN a section too. This exists because session limits and
  connection drops repeatedly cut agents mid-run; small commits mean a cutoff costs a
  resume, not lost work. Interrupted agents are resumed via SendMessage with a precise
  "here is what is on disk, here is what remains" nudge.
- Every section verifies before committing: `npm run build`, `npx vitest run`,
  `npm run lint`, and `grep -rn "—\|–" src --include=*.tsx --include=*.ts` MUST be empty
  (em/en-dashes are banned in this codebase; the middot character IS allowed, the brand
  uses it).
- Verify in a real browser where possible (`.claude/launch.json` has `prod` = build+start
  and `dev`). CAVEAT: the embedded preview pane throttles animation frames and often
  renders scroll-reveal sections blank and desyncs screenshots from programmatic scroll.
  Verify structure/state via DOM (computed styles, getBoundingClientRect) instead of
  pixels for below-the-fold content; only the owner's real browser judges motion.
- Commit trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` (agents) or
  the current model's name.

## Architecture in one paragraph
Next.js 16 App Router (`src/`), Tailwind v4, Drizzle ORM. DB: PGlite in dev/test
(`.data/pgdata`, auto-DDL via `CREATE_TABLES_SQL` in `src/lib/db/schema.ts`; additive
`ALTER ... IF NOT EXISTS` for new columns), Postgres/Neon in prod via `DATABASE_URL`
(`@electric-sql/pglite` and `pg` are in `serverExternalPackages`, do not remove). EVERY
external service sits behind an env-selected seam with a mock, so the whole shop runs end
to end with an empty .env: `getImageProvider()` (mock vs OpenAI gpt-image-1),
`getEmailTransport()` (console mock vs Resend), `getNewsletterProvider()` (mock vs Resend
Audience), `payfastConfig`/`usingMockPayfast` (mock panel vs sandbox/live), storage (local
`.data/` + signed URLs vs Vercel Blob), GA4 (inert without id). Never hard-code a
credential; add env vars to `.env.example`.

## Security invariants (do not weaken; tests pin them)
- Only the verified PayFast ITN webhook (`src/app/api/payfast/notify/route.ts`) can mark
  an order paid: signature + server-confirmation postback + merchant id + amount vs the DB
  row; idempotent via UNIQUE `webhook_events.payfastPaymentId`; admin has NO mark-paid.
- Checkout re-derives every price server-side from `src/lib/products.ts`; client prices
  are never trusted. Shipping: flat R99, free >= R1000 (matches the utility-bar promise).
- Fulfilment runs AFTER the webhook 200 (`after()`); print files are per ORDER ITEM at
  that product's 300 DPI `printPixels` (B3 refactor), idempotent per item;
  `artworks.printKey` is legacy. `flagged` has two meanings: paid-but-print-failed
  (retryable) vs never-reconciled payment (`payfastPaymentId` null; retry REFUSES it or
  you print a free garment).
- Auth is custom HMAC (NO Auth.js): admin cookie keyed off ADMIN_PASSWORD_HASH
  (`src/lib/admin/{session,auth}.ts`; scrypt hash uses `:` separators because dotenv eats
  `$`); customer magic-link (`src/lib/account/*`): single-use hashed tokens, ~15 min,
  no account enumeration anywhere, signed 30-day session cookie; account queries are
  session-scoped and reorder authorization STARTS from the caller's own paid orders
  (reachability = authorization). Order-status links are HMAC tokens
  (`src/lib/order-token.ts`) and NEVER grant login. Order lookup requires ref+email
  together with one generic miss (no enumeration).
- Emails: helpers return `EmailResult` and never throw for sends; a dead mailbox must
  never unwind a paid order or lose a subscriber.

## Design system (authoritative; kit-locked)
`design/DESIGN-SYSTEM.md` is the source of truth (from the owner's Claude Design UI kit in
`design/`). Parchment stone-greige, bark ink, oxblood accent, camel secondary, maroon
inverse bands; Young Serif display (400 only) + Archivo body + Archivo-900 uppercase
"varsity block" eyebrows; near-square radii 2-6px; border-first elevation; **light-only
storefront** (dark mode was removed on purpose; owner rejected it twice). Eyebrows above
every section heading (owner override of generic taste rules); `AccentRule` (two stacked
lines oxblood/camel) marks CENTERED brand moments only. Signature animations: DeliveryDog
+ CartDog (`src/components/creatures/`). A cat-swat animation was built 3x and DELETED by
owner decision: do NOT rebuild it. All imagery is `PhotoFrame` hatched placeholders whose
captions ARE the photography shot list. Copy: warm, human, "we draw/hand-finish", zero
em/en-dashes.

## State: DONE (all committed, ~700+ tests green)
- Core build S1-S10 (`docs/superpowers/plans/remaining-sections.md`): storefront,
  customizer, cart/checkout/PayFast, fulfilment+admin, SEO (JSON-LD/sitemap/llms.txt), GA4.
- Distinct pages P1-P3 (`docs/superpowers/plans/distinct-pages.md`): /shop catalogue,
  /how-it-works trust page; product page + customizer merged into one flow
  (`ProductFlow`; /customize/* 308-redirects to /products/*).
- Conversion pass: trust band, closing CTA band, CTA label discipline (START YOUR
  PORTRAIT = start intent everywhere; SHOP THE RANGE = browse; Personalise = configure).
- Retention A (newsletter) A1-A4 and Retention B (accounts/"your creatures") B1-B4
  (`docs/superpowers/plans/retention-{a,b}-sections.md` + specs in
  `docs/superpowers/specs/`). One-click reorder works cross-product.
- Delivery hardening D1 (public ref KC-YYMM-XXXXX + /order-lookup) and D2 (email
  typo-catcher on all email fields, "Paying as <email>" + Edit + pause on the PayFast
  handoff, phone on the job sheet) and D3 (auto-account + one-time welcome login on the
  PayFast return_url only; ITN webhook find-or-creates + claims server-side; order-status
  token still never logs in; token consume happens via `/api/account/welcome` redirect
  because server components cannot set cookies) and D4 (email delivery monitoring:
  `email_events` + `order_emails` tables, Svix-verified `POST /api/webhooks/resend`
  fails closed without `RESEND_WEBHOOK_SECRET`; bounce sets `orders.email_bounced_at`
  (deliberately NOT `flagged`, which stays money/print-lifecycle only) + admin chip +
  needs-attention; never auto-resend) —
  `docs/superpowers/plans/delivery-hardening-sections.md`.

## NEXT UP (owner-prioritised backlog; delivery hardening D1-D4 all done)
Retention C (reviews) and D (upsells) need specs
   first (`docs/design-tweaks.md` items 7-8 are blocked on the print partner:
   embroidery file format + a curated sayings range). Phase-A admin settings (price
   overrides, shipping knobs, announcement bar, product visibility) discussed and wanted
   but unplanned. Real photography (shot list = the PhotoFrame captions). Test-DB
   isolation fix (see Known issues).

## Known issues
- **Test flake**: the suite shares `.data/pgdata`; cold runs intermittently fail 5-14
  DB-backed files, re-runs pass. An owner-run background worktree was fixing isolation;
  check whether it merged. Never conclude a real failure from one cold run; never weaken
  a money-path assertion for a flake.
- One pre-existing lint warning (`welcome.ts` unused `FONT_BODY`; the old `login-tokens.ts`
  unused `sql` warning was cleared by the D3 rewrite). Untracked owner files at repo root (`AI_PHOTO_SYSTEM.md`,
  `CUSTOMER_JOURNEY_REDESIGN.md`): leave them alone.
- Footer email is `hello@kindredcreatures.co.za` but the real domain is unconfirmed
  (`docs/design-tweaks.md` item 4).

## Owner inputs still needed before a live order (all env-swap, no code)
OPENAI_API_KEY; RESEND_API_KEY + verified sending domain + RESEND_AUDIENCE_ID +
PRINT_SHOP_EMAIL + EMAIL_FROM/REPLY_TO + sender-identity line; PAYFAST merchant id/key/
passphrase (+PAYFAST_SANDBOX first); ORDER_TOKEN_SECRET + SESSION_SECRET;
ADMIN_EMAIL + ADMIN_PASSWORD_HASH (`node scripts/hash-admin-password.ts`);
NEXT_PUBLIC_SITE_URL + domain decision; NEXT_PUBLIC_GA_MEASUREMENT_ID;
NEXT_PUBLIC_GOOGLE_REVIEWS_URL; real print-shop dimensions/costs -> update
`src/lib/products.ts` prices + shipping constants in `src/lib/checkout.ts`; photography.

## Key file map
`src/lib/`: products, checkout, payfast, order-token, order-ref, order-lookup, fulfillment,
email/ (send+templates), images/, newsletter/, account/ (session,auth,customers,
login-tokens,creatures), admin/ (session,auth,orders,subscribers,fulfillment-ops),
cart-store, analytics, seo/, storage, db/. `src/app/`: pages + api routes mirror the
above. Plans+specs: `docs/superpowers/`. Design backlog: `docs/design-tweaks.md`.
