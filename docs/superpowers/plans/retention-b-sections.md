# Retention B build: sectioned for token-safety

Spec: `docs/superpowers/specs/2026-07-20-retention-b-accounts-design.md` (agents read it in
full). Each section is one agent run ending in a commit; agents also commit after each
logical chunk WITHIN a section so a mid-run cutoff loses almost nothing. One agent at a time,
sequential. Order matters: B3 (print refactor) must land before B4 (re-order) so a re-order
onto a different product prints at the right size.

Every section: read the spec + `design/DESIGN-SYSTEM.md` first; verify
`npm run build && npm test && npm run lint` and `grep -rn "—\|–" src --include=*.tsx
--include=*.ts` empty; commit trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
Known flake: cold test runs can fail DB-backed files (shared `.data/pgdata`); re-run.

## B1. Auth foundation: customers, magic link, session  [DONE 2f15ef9, b6a2a53, 93751aa]
Schema (+ DDL): `customers` (id, email unique normalised, name nullable, createdAt),
`login_tokens` (id, email, tokenHash, expiresAt, usedAt nullable, createdAt), and add
`orders.customerId` (nullable fk). Custom magic-link + signed session, mirroring the admin's
signed-cookie approach (do NOT add Auth.js): `sendMagicLink` email composer;
`POST /api/account/login` (find-or-create customer, mint single-use hashed token ~15min,
email link, NO account enumeration, rate-limit per email); `GET /api/account/callback?token=`
(verify not expired/used, mark used, set signed httpOnly secure SameSite session cookie with
customerId, redirect to /account, graceful expired-link state); `getCustomerFromRequest()` /
`requireCustomer()` / logout. **Claim on login:** UPDATE orders SET customerId WHERE
lower(email)=me AND customerId IS NULL. Commit chunks: schema+session, then login/callback+
email, then claim. Tests per spec (single-use, expiry, tamper, no enumeration, session
admit/refuse, claim attaches only matching-email guest orders).
**Commit:** `feat: customer accounts with magic-link login`.
**Done when:** with no keys, requesting a link logs a magic link via the mock transport;
following a valid (mock) token sets a session and claims matching guest orders; expired/used/
tampered tokens refused without enumeration.

## B2. Account pages: creatures gallery + order history  [pending]
`/account/login` (email -> "check your email"), `/account` (requireCustomer): Your creatures
gallery (cards: previewKey thumb via signed URL + style label + "Wear this again" CTA ->
B4's reorder, which may 404 until B4 lands: link it, note it), Your orders (status list),
empty states. Creatures = DISTINCT artworks from the customer's PAID orders (scoped by
session customerId; authorization on every by-id fetch). Nav "Account" entry (person icon)
-> /account when logged in else /account/login, single-line nav preserved. Analytics
account_login_requested / account_logged_in. Design system throughout. Tests: only the
caller's paid-order artworks appear; another customer sees only theirs; requireCustomer gates
the page.
**Commit:** `feat: account pages with creatures gallery and order history`.
**Done when:** a logged-in customer sees their creatures + orders; a stranger is bounced to
login; queries are session-scoped.

## B3. Print-file-per-order-item refactor (MONEY PATH, careful)  [pending]
The one risky section. Add `order_items.printKey` (nullable). Move S7 fulfilment to generate
a print file PER order_item at THAT product's `printPixels` (300 DPI), idempotent per
order_item (skip if the order_item already has a printKey), NOT per artwork. Job-sheet email
and admin print links read the order_item's printKey. Keep `artworks` (uploadKey/style/
previewKey) as the reusable inputs; retire reliance on `artworks.printKey`. Preserve every
existing S5/S7 guarantee (paid-only, idempotent within an order, flagged-on-failure, no
double-bill). Tests: a re-order of the same artwork onto a DIFFERENT product yields a
correctly-sized DISTINCT print file; idempotency still prevents double generation within one
order; existing paid orders still fulfil; job sheet reads order_item printKey. Do NOT weaken
the ITN/webhook security.
**Commit:** `feat: per-order-item print files for cross-product reorders`.
**Done when:** fulfilment writes a correctly-sized print file per order_item, idempotent, and
all existing fulfilment tests plus the new sizing/idempotency tests pass.

## B4. Re-order flow: creature to cart  [pending]
`/account/reorder/[artworkId]` (or inline on /account): authorize the artwork belongs to one
of the caller's PAID orders (refuse otherwise); pick product + colour + size; add to cart
with the EXISTING artworkId (no upload, no generation, no regeneration credit). Reuse the
cart-store item shape; checkout still re-derives price server-side. Analytics
creature_reordered. Tests: authorization (cannot reorder another customer's or an unpaid
artwork); cart line carries the existing artworkId and triggers no generation; a re-order
onto a different product fulfils at the right size (ties to B3).
**Commit:** `feat: one-click reorder of a saved creature`.
**Done when:** a logged-in customer re-orders a saved creature onto any product straight to
cart, and it fulfils with a correctly-sized print file.

## After B4
Subsystem C (reviews) gets its own spec. Owner inputs: SESSION_SECRET/ORDER_TOKEN_SECRET in
prod, Resend sending domain (already needed).
