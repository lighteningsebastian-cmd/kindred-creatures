# Delivery hardening: pre-launch order-contact safety (sectioned for token-safety)

Owner concern: a mistyped email on a guest order is the one failure mode where the customer
loses their only key to the order. Decisions locked with the owner (2026-07-21):
- NO hard verify-email-before-pay gate. Instead a friction-free net: typo-catcher on the
  email field, reference + "paying as <email>, edit?" on the PayFast handoff, phone as the
  admin fallback contact. Revisit a gate only if delivery monitoring shows real bounces.
- Auto-login on the payment return via a SINGLE-USE short-expiry token minted at checkout
  and carried in the return_url. The emailed order-status link stays login-free (shareable
  links must never grant account access). Webhook auto-creates the customer + claims the
  order server-side regardless (no cookie from a webhook: impossible).
- Public order reference exists from order creation; self-service lookup requires
  REF + EMAIL TOGETHER (a short ref alone is enumerable; never show PII from ref alone).
- Email delivery monitoring via Resend webhooks -> admin flags + manual resend. NO auto
  re-send to the same failed address (it fails identically). Phone (already captured at
  checkout) becomes the visible fallback: it must reach the job sheet + admin.

Facts: `orders.phone` already exists and is required at checkout. `orderRef(order.id)`
exists (uuid-derived); it needs a customer-friendly stored form. One agent per section,
sequential; commit per chunk within sections. Every section: verify `npm run build`,
`npx vitest run` (cold-flake: re-run), `npm run lint`, dash grep empty; trailer
`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## D1. Public order reference + safe lookup  [DONE 0febd17, 6392774, 0f4224a]
- `orders.publicRef` text unique + DDL (+ALTER IF NOT EXISTS), generated at order creation
  in `/api/checkout` (format `KC-<YYMM>-<5 unambiguous alphanumerics>`, collision-retried,
  no vowels to avoid words). Backfill not needed (pre-launch).
- Show it: checkout handoff panel, order confirmation/status page, confirmation email,
  job sheet, admin list + detail (alongside the short uuid ref or replacing it).
- `/order-lookup` page (indexable no, nav footer link yes "Find my order"): form asking
  reference + email; server action matches BOTH (normalised email, case-insensitive ref);
  on match redirect to the existing signed order-status URL; on miss one generic "we could
  not match that reference and email" (identical for wrong-ref/wrong-email/none: no
  enumeration); simple per-IP/session attempt delay. Tests: format/uniqueness, both-required
  matching, generic miss, status URL only on match.
**Commit:** `feat: public order reference and safe order lookup`.

## D2. Checkout email net + phone plumbed through  [DONE 94aa028, a9d5fcd, bc8b832]
- Email typo-catcher on the checkout email field (and reuse on /account/login +
  newsletter footer if trivial): client-side suggestion for common domains (gmail.com,
  icloud.com, outlook.com, yahoo.com, webmail.co.za, mweb.co.za, telkomsa.net etc.),
  "Did you mean thandi@gmail.com?" tap-to-accept. Never blocks submission.
- PayFast handoff panel: show `publicRef` + "Paying as <email>" + an Edit control that
  returns to the form with email focused (order still pending; a corrected email means
  creating a fresh order or updating the pending one server-side: choose updating the
  pending order's email via a small authorized action tied to the checkout session, and
  justify; simplest correct wins).
- Phone: ensure it renders on the job sheet (courier contact) and admin order detail; add
  to the mock job-sheet text. Tests: suggestion appears/accepts, never blocks; handoff
  shows ref + email; job sheet contains phone.
**Commit:** `feat: checkout email safety net and phone on job sheet`.

## D3. Auto-account + auto-login on payment return  [done]
- At checkout creation: mint a SINGLE-USE, ~30-min, hashed-at-rest login token bound to the
  order's email (reuse `login_tokens` + issue/consume machinery from B1; a dedicated
  `purpose` column or a separate mint path if cleaner), append `?welcome=<raw>` to the
  PayFast `return_url` ONLY (never cancel_url, never the emailed status link).
- Return/confirmation page: if a welcome token is present and consumes cleanly, find-or-
  create the customer, claim orders by email, set the session (exact B1 primitives), then
  render already-logged-in confirmation (ref, status, tracking, "your creatures" teaser);
  an invalid/expired/absent token renders the normal login-free page identically (never an
  error). The signed ORDER-STATUS token continues to grant NO login ever.
- ITN webhook additionally (server-side only): find-or-create customer + claim on payment,
  so the account exists even if the buyer never returns from PayFast. No cookie logic in
  the webhook.
- Tests: token single-use/expiry/tamper; the order-status link alone never logs in;
  webhook creates+claims; return with valid token = session set + claimed; without = page
  still fine.
**Commit:** `feat: auto account and one-time login on payment return`.

## D4. Email delivery monitoring  [done]
- `email_events` table (id, provider messageId, to, type delivered|bounced|complained,
  orderId nullable, receivedAt, raw) + DDL. Store the provider message id returned by the
  transport when sending order-related mail (confirmation, job sheet, shipping) keyed to
  the order.
- `POST /api/webhooks/resend` verifying Resend's webhook signing secret
  (`RESEND_WEBHOOK_SECRET`, env-gated; mock mode: endpoint exists, verifies, logs). Record
  events; on bounce of an order email set a visible admin flag on that order ("email
  bounced, phone the customer"), never auto-resend to the same address.
- Admin: per-order email status chip (sent/delivered/bounced) + existing resend controls;
  orders-needing-attention filter includes bounced-email orders.
- Tests: signature verification (reject bad), event recording + order association, bounce
  flags order, no auto-resend.
**Commit:** `feat: email delivery monitoring via resend webhooks`.

## Out of scope (named)
SMS sending (needs a provider; phone visibility is the v1 fallback), hard verify-before-pay
gate (revisit with bounce data), backfilling refs (pre-launch, none to backfill).
