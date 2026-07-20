# Retention Subsystem A: Email capture + newsletter

**Date:** 2026-07-20
**Status:** Approved by owner (Sebastian)
**Part of:** the customer-retention roadmap (A email/newsletter -> B customer profiles
"your creatures" -> C reviews -> D upsells). This spec covers **A only**. B, C, D get
their own specs later. The Google-reviews link rides along in A because it is tiny.

## Strategic frame (why A is first)
Custom pet apparel is a low-frequency, high-emotion purchase. Retention is driven by
"same portrait, new product" re-orders (the artwork already exists in the `artworks`
table), gifting, and referral. The email list is the re-engagement channel that makes all
of that reachable, and it can start growing immediately with no dependency on accounts.
So A ships first and is deliberately account-free.

## Decisions locked (owner)
- **Tooling:** own the subscriber list in our own DB; use Resend Audiences + Broadcasts
  (same account as transactional email) to send newsletters and handle unsubscribe;
  trigger lifecycle emails from our own events via the existing Resend transactional
  layer. All behind a `NewsletterProvider` interface with a mock, so Resend can be
  swapped for Klaviyo later without touching capture UX. No Klaviyo at launch.
- **Incentive:** none at launch. Value proposition is "first look at new styles + the
  occasional story worth reading". A monetary discount is explicitly OUT of scope because
  it requires a discount-code subsystem we have not built; that is a future piece.
- **Opt-in:** single opt-in + a welcome email. POPIA-compliant via clear consent + easy
  unsubscribe. No pre-ticked boxes anywhere.
- **Surfaces:** footer signup form (every page) + checkout opt-in checkbox (unticked).
  No popup/modal at launch.

## Architecture (fits existing patterns)
External services are env-gated with a mock, exactly like `getImageProvider()`,
`payfastConfig`, `getEmailTransport()`. Add:

- `src/lib/newsletter/provider.ts` — `NewsletterProvider` interface:
  `subscribe({ email, source }): Promise<{ ok: boolean }>`,
  `unsubscribe({ email }): Promise<{ ok: boolean }>`. Pure contract.
- `src/lib/newsletter/mock.ts` — logs a readable summary, always ok. Default when
  `RESEND_API_KEY` / `RESEND_AUDIENCE_ID` absent or `MOCK_SERVICES` truthy.
- `src/lib/newsletter/resend.ts` — real provider: upsert/remove a contact in a Resend
  Audience (`RESEND_AUDIENCE_ID`). Lazily constructed only when keys exist.
- `src/lib/newsletter/index.ts` — `getNewsletterProvider()` selects mock vs real like the
  other providers.

**Data (owned truth), extend `src/lib/db/schema.ts`:**
- `subscribers`: `id` (uuid), `email` (unique, lowercased/trimmed), `source`
  (`footer` | `checkout`), `status` (`active` | `unsubscribed`), `consentAt` (timestamptz),
  `createdAt`. Add DDL to the dev/test `CREATE_TABLES_SQL` the way `artworks`/`orders` do.
- Idempotency: re-subscribing an existing active email is a no-op success (do not create
  duplicates, do not error). Re-subscribing an `unsubscribed` email reactivates it with a
  fresh `consentAt`.

## Flow
1. **Capture (footer or checkout):** `POST /api/newsletter/subscribe` with `{ email, source }`.
   - Validate email server-side. Reject obviously invalid; return a friendly result.
   - Upsert the `subscribers` row (record `source`, `consentAt = now`, `status active`).
   - Call `provider.subscribe(...)` to push to the Resend Audience (mock logs in dev).
   - Fire the **welcome email** via the existing `getEmailTransport()` / a new
     `sendWelcome(email)` composer in `src/lib/email/` (warm, on-brand, sets expectations,
     links to `/shop`, carries sender identity + contact line + an unsubscribe link).
   - Return a typed result; a failed provider push or welcome send must NOT lose the
     subscriber (log + succeed, same policy as the fulfillment email layer).
2. **Checkout opt-in:** the checkout form gains an unticked "Keep me posted" checkbox.
   On submit, if ticked, the checkout route (or a small client call) subscribes the email
   with `source: checkout`. Do NOT block or complicate the order path if the subscribe
   call fails; the order is the priority.
3. **Unsubscribe:** `GET /api/newsletter/unsubscribe?token=...` where the token is an HMAC
   of the email using `ORDER_TOKEN_SECRET` (reuse the HMAC signing util in
   `src/lib/order-token.ts` from S5, generalised to sign an arbitrary string if needed).
   The route sets `status unsubscribed`, calls `provider.unsubscribe`, then renders a
   plain confirmation at `src/app/unsubscribe/page.tsx` in the brand voice (noindex).
   Every marketing email includes this link AND a `List-Unsubscribe` header for one-click
   in Gmail/Apple Mail.

## UI (design system: parchment, Young Serif, Archivo, oxblood, near-square, eyebrows for
left-aligned, AccentRule for centered moments)
- **`NewsletterSignup` component** (client island, small): label-above input (email),
  a `Button` submit, inline states (idle / submitting / success "You are on the list." /
  error / already-subscribed friendly). Uses `<Input>`; AA contrast; reduced-motion safe.
  Placed in the footer. A centered variant (with `AccentRule`) may be reused later; footer
  version is left-aligned to match footer columns.
- **Checkout checkbox:** unticked, clear label, sits above the pay button; consent copy
  states what they are signing up for. No pre-tick.
- **Google reviews link:** a small `GoogleReviewsLink` (footer + reusable) reading
  `NEXT_PUBLIC_GOOGLE_REVIEWS_URL` from env; renders nothing if unset (so it is safe before
  the owner supplies the Google Business Profile URL). Phosphor star icon, "Read our
  Google reviews".
- Zero em/en-dashes; middot allowed. Copy warm, specific, human. All strings pass the copy
  self-audit.

## Admin
Add a minimal panel to the existing admin: subscriber count (active / unsubscribed) and a
CSV export (email, source, status, consentAt). Auth-gated like the rest of `/admin`. No
campaign UI (Resend owns sending).

## Analytics
Fire `newsletter_signup` (with `source`) on a successful subscribe. No PII in the event
(source only, not the email). Extend `src/lib/analytics.ts` event map.

## Env (add to `.env.example`, all optional; mock runs without them)
`RESEND_AUDIENCE_ID`, `NEXT_PUBLIC_GOOGLE_REVIEWS_URL`. `RESEND_API_KEY`,
`ORDER_TOKEN_SECRET`, `MOCK_SERVICES`, `NEXT_PUBLIC_SITE_URL` already exist.

## Tests
- Subscribe: valid email creates one active subscriber; duplicate active is a no-op;
  re-subscribing an unsubscribed email reactivates with new `consentAt`; invalid email
  rejected; provider push failure still records the subscriber (does not throw to caller).
- Unsubscribe: valid token flips to `unsubscribed` and calls provider; tampered/forged
  token is rejected (no leak of another email); idempotent (unsubscribing twice is fine).
- Provider selection: mock without keys, resend with keys (construction only, no network).
- Welcome email composer renders the brand template with an unsubscribe link and sender
  identity; goes to the subscriber; no secrets leaked.
- Google reviews link renders only when the env URL is set.
- Checkout opt-in: ticked subscribes with `source: checkout`; unticked does not; a failed
  subscribe never blocks the order.
- No network in tests; reuse the test DB and mock transport patterns.

## Out of scope for A (named so they are not built here)
- Customer accounts / saved artworks / re-order (subsystem B).
- On-site reviews + review-request email + AggregateRating schema (subsystem C).
- Upsells, discount codes, bundles, embroidery (subsystem D + backlog).
- Popup/modal capture, exit-intent, referral program (possible later; not now).
- Segmented flows / automation beyond the single welcome email (Resend Broadcasts handles
  manual newsletters; automation is a later upgrade or a Klaviyo swap).

## Owner inputs needed before the real (non-mock) path works
- Resend Audience created; `RESEND_AUDIENCE_ID` supplied.
- Google Business Profile set up; its reviews URL supplied.
- A verified sending domain on Resend (already needed for transactional email).
- Physical/contact line for the marketing-email footer (POPIA sender identity).
