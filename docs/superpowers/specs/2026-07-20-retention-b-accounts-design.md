# Retention Subsystem B: Customer accounts + "Your creatures"

**Date:** 2026-07-20
**Status:** Approved by owner (Sebastian)
**Part of:** the retention roadmap (A newsletter DONE -> **B accounts/creatures** -> C reviews
-> D upsells). This spec covers B only.

## Why B is the centerpiece
For a low-frequency purchase, retention = "same portrait, new product". Every portrait a
customer has paid for already exists in `artworks`. B gives those a home behind a login and
lets a returning customer re-order a saved creature onto any product in one click, skipping
upload and generation entirely. That is the whole thesis.

## Decisions locked (owner)
- **Auth: magic link (passwordless).** Enter email, receive a one-time login link, a session
  is set. No passwords, no reset flows; reuses the email layer + HMAC token infrastructure.
- **v1 scope:** saved creatures with one-click re-order + order history. NO saved addresses,
  named pets, or email preferences yet (later).
- **Guest checkout stays, untouched.** Accounts are additive. Forcing accounts kills
  conversion. Existing token order-lookup keeps working for pure guests.

## THE ONE HARD PART (money path): print files are per garment, not per artwork
Today S7 generates ONE high-res print file per `artwork` (`artworks.printKey`) at that
order's product dimensions, and is idempotent by skipping if `printKey` is already set (to
avoid re-billing generation). **Re-order breaks that assumption:** the same portrait printed
on a different product needs a print file at a DIFFERENT print area (300 DPI of a different
mm size). Reusing `artworks.printKey` would ship a wrong-sized print.

**Required refactor (careful, tested, money-path):** move the print file from the artwork to
the **order item**. Add `order_items.printKey` (nullable). Fulfillment generates a print
file per order_item at THAT product's `printPixels`, idempotent per order_item (skip if the
order_item already has a `printKey`). The artwork keeps `uploadKey`/`style`/`previewKey`
(the reusable inputs); `artworks.printKey` is retired or left only as a legacy cache.
The job-sheet email and admin print links read the order_item's `printKey`.
This must land with tests proving: a re-order of the same artwork onto a different product
produces a correctly-sized, distinct print file; idempotency still prevents double-billing
within one order; existing paid orders still fulfil.

## Architecture (mirrors existing patterns; no Auth.js — match the admin's signed-cookie
approach from S8)
**Data (extend `src/lib/db/schema.ts`, add DDL to `CREATE_TABLES_SQL`):**
- `customers`: `id` uuid, `email` unique (normalised lowercase), `name` (nullable, seeded
  from an order's firstName when claimed), `createdAt`.
- `login_tokens`: `id`, `email`, `tokenHash` (store a hash, never the raw token),
  `expiresAt` (~15 min), `usedAt` (nullable, single-use), `createdAt`.
- `orders.customerId` (nullable fk -> customers.id). Guest orders have null until claimed.
- `order_items.printKey` (nullable) per the money-path refactor above.

**Auth flow (custom magic link + signed session, reuse `src/lib/order-token.ts` HMAC + the
email layer):**
1. `POST /api/account/login` `{ email }`: find-or-create `customers` row; mint a single-use
   token (random, store only its hash in `login_tokens` with a 15-min expiry); email the
   login link via a new `sendMagicLink` composer. **No account enumeration:** always respond
   the same ("check your email"), whether or not the address existed. Rate-limit per email.
2. `GET /api/account/callback?token=`: look up by hash, verify not expired and `usedAt` null;
   mark used; set a signed, httpOnly, secure, SameSite session cookie carrying `customerId`
   (longer-lived, ~30 days); redirect to `/account`. Invalid/expired/used -> a graceful
   "this link has expired, request a new one" page, never a crash, never a hint about the
   address.
3. `getCustomerFromRequest()` / `requireCustomer()` verify the session cookie (mirror the
   admin's `isAdminRequest`/`requireAdmin`). Logout clears the cookie.
4. **Claim on login:** the first time a customer authenticates, and on each login,
   `UPDATE orders SET customerId = ? WHERE lower(email) = ? AND customerId IS NULL`, so past
   guest orders (and thus their creatures) attach to the account by email.

**Derived data (no duplication):**
- "Your creatures" = the DISTINCT `artworks` reachable from the customer's PAID orders
  (`orders.customerId = me AND status in paid|sent_to_printer|printed|shipped` -> order_items
  -> artworks). These are portraits they actually own. The card thumbnail is the artwork's
  `previewKey` (the watermarked preview) served via a signed URL, plus the style label. The
  high-res print file is never shown; the preview is the display-safe asset we hold.
- Order history = the customer's orders with status, via the existing order data + the token
  page for detail (or an account-scoped detail view; reuse the order status rendering).

## Pages (design system: parchment, Young Serif, Archivo, oxblood, near-square, eyebrows for
left-aligned, AccentRule for centered moments)
- `/account/login` (or a modal): email input, "email me a link" `Button`, the "check your
  email" confirmation. Warm, honest, POPIA-clean.
- `/account` (requireCustomer): header, **Your creatures** gallery (cards: preview thumb,
  style, a primary "Wear this again" CTA), and **Your orders** (status list). Empty states
  for someone who is logged in but has no paid orders yet.
- `/account/reorder/[artworkId]` (or an inline flow): pick product + colour + size for a
  saved creature, then add to cart with the EXISTING `artworkId` (no upload, no generation
  step, no regeneration credit spent). Reuses the cart-store item shape
  `{ productSlug, color, size, qty, artworkId, unitPriceZar }` and the checkout re-derives
  price server-side as always. Confirm the artwork belongs to the requesting customer before
  allowing re-order (authorization check: the artwork must be reachable from one of the
  caller's paid orders).
- Nav: add an "Account" entry (person icon) that goes to `/account` when logged in, else
  `/account/login`. Do not disrupt the existing nav line.

## Guest path unchanged
Checkout stays guest-capable exactly as built. A logged-in customer's checkout may prefill
email and set `orders.customerId` at order creation; a guest's stays null and is claimed
later if they ever sign up with that email.

## Security / privacy
- Magic tokens: single-use, short expiry, only the hash stored, constant-time compare, one
  outstanding token supersedes older ones. Session cookie signed + httpOnly + secure +
  SameSite=Lax. No account enumeration anywhere. Re-order and account pages authorize the
  caller owns the data. POPIA: clear consent already covered by A; account holds only email
  + name + derived order data.
- Never expose another customer's orders/creatures. Every account query is scoped by the
  session `customerId`; every by-id fetch (artwork, order) is authorization-checked.

## Analytics
`account_login_requested`, `account_logged_in`, `creature_reordered` (no PII).

## Env (add to `.env.example`, optional; mock runs without them)
Reuses `ORDER_TOKEN_SECRET` (or a dedicated `SESSION_SECRET` if cleaner), `RESEND_API_KEY`,
`NEXT_PUBLIC_SITE_URL`. No new external service.

## Tests (this subsystem is auth + money-path; be thorough)
- Magic link: login mints a single-use token + emails it; callback with a valid token sets a
  session and claims guest orders by email; expired/used/tampered token refused gracefully;
  no enumeration difference between known/unknown email; rate-limit holds.
- Session: `requireCustomer` admits a valid cookie, refuses a missing/forged one.
- Claiming: guest orders matching the email attach on login; orders with another email do not.
- Creatures: only the caller's paid-order artworks appear; a different customer sees theirs
  only; an artwork from an unpaid/other order is not reorderable (authorization).
- **Print-file refactor:** re-ordering an artwork onto a DIFFERENT product yields a print
  file at the new product's 300 DPI dimensions, distinct from the original; idempotency
  still prevents double generation within an order; existing paid-order fulfilment still
  works; the job sheet reads the order_item printKey.
- Re-order builds a cart line with the existing artworkId and no generation call; checkout
  still re-derives price.
- No network in tests; reuse the test DB + mock email/image patterns.

## Out of scope for B (named so they are not built here)
- Saved addresses, named pets, email preferences (later).
- Reviews (C), upsells/discounts/bundles (D).
- Social login (magic link only for v1; Google can layer on later).
- Merging two accounts / email change flows.

## Owner inputs before the real path
Resend sending domain (already needed), `SESSION_SECRET`/`ORDER_TOKEN_SECRET` in prod.
