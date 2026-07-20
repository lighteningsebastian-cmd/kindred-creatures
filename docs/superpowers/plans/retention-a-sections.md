# Retention A build: sectioned for token-safety

Spec: `docs/superpowers/specs/2026-07-20-retention-a-newsletter-design.md` (agents read it
in full; this file only sequences the work and fixes commit points). Each section is one
agent run ending in a commit; agents also commit after each logical chunk WITHIN a section
so a mid-run cutoff loses almost nothing. One agent at a time, sequential (same repo).

Every section: read the spec + `design/DESIGN-SYSTEM.md` first; verify
`npm run build && npm test && npm run lint` and `grep -rn "—\|–" src --include=*.tsx
--include=*.ts` empty; commit trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
Known flake: cold test runs can fail DB-backed files (shared `.data/pgdata`); re-run.

## A1. Data + provider seam  [pending]
`subscribers` table + DDL in `CREATE_TABLES_SQL` (per spec, incl. idempotency/reactivation
semantics). `src/lib/newsletter/{provider,mock,resend,index}.ts` with `getNewsletterProvider()`
selecting mock vs Resend by env, matching `getImageProvider()`. `resend` client lazily
constructed only when keys exist. Tests: provider selection (mock without keys, resend with
keys, construction only), and (if a small DB helper is added) subscriber upsert/reactivate.
**Commit:** `feat: subscribers table and newsletter provider seam`.
**Done when:** provider selects correctly by env; schema + DDL in place; tests green.

## A2. Subscribe/unsubscribe flow + welcome email  [pending]
`POST /api/newsletter/subscribe` (validate, upsert subscriber, push to provider, fire
welcome, never lose the subscriber on provider/email failure). `sendWelcome` composer in
`src/lib/email/` (brand template, unsubscribe link, sender identity, List-Unsubscribe).
`GET /api/newsletter/unsubscribe?token=` (HMAC via `src/lib/order-token.ts`, generalise to
sign an arbitrary string if needed) + `src/app/unsubscribe/page.tsx` (noindex, brand voice).
Tests per spec: subscribe valid/duplicate/reactivate/invalid/provider-failure; unsubscribe
valid/tampered/idempotent; welcome renders with unsubscribe link + sender identity, no
secrets. Commit the email composer separately from the routes if convenient.
**Commit:** `feat: newsletter subscribe, unsubscribe, and welcome email`.
**Done when:** with no keys, subscribing logs a welcome via the mock transport and creates
one active subscriber; a signed unsubscribe flips status; tampered token rejected.

## A3. Capture surfaces + Google reviews link + analytics  [pending]
`NewsletterSignup` client island in the footer (label-above input, idle/submitting/success/
error/already-subscribed states, AA, reduced-motion safe). Checkout opt-in checkbox
(unticked; ticked subscribes with `source: checkout`; a failed subscribe never blocks the
order). `GoogleReviewsLink` reading `NEXT_PUBLIC_GOOGLE_REVIEWS_URL` (renders nothing if
unset), placed in the footer. Fire `newsletter_signup` (source only, no PII) via
`src/lib/analytics.ts`. Add env vars to `.env.example`. Browser-verify the footer form
(it renders in the preview pane; drive a subscribe against the mock).
**Commit:** `feat: newsletter signup surfaces and google reviews link`.
**Done when:** footer signup works end to end against the mock; checkout opt-in subscribes
without blocking the order; reviews link appears only when its env URL is set.

## A4. Admin subscriber panel  [pending]
Minimal admin addition (auth-gated like the rest of `/admin`): active/unsubscribed counts
and a CSV export (email, source, status, consentAt). No campaign UI. Tests for the export
shape + auth gate.
**Commit:** `feat: admin newsletter subscriber count and export`.
**Done when:** admin shows counts and exports a correct CSV; unauthenticated access blocked.

## After A4
Owner inputs for the real path (Resend Audience id, Google Business Profile URL, sender
identity line) per the spec's "Owner inputs" section. Then subsystem B (customer profiles /
"your creatures") gets its own spec.
