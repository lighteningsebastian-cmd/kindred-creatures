# Handover: first real order, part-way through

**16 September 2026.** Work against `docs/spec-first-real-order-16-sep.md`, stopped at a
session limit. Read this first, then the spec.

**Update from the owner, after the session:** this was a TEST order, not a live one. The
site is still in development and PayFast is still the sandbox, so no customer is waiting
and no real money moved. Both emails did land; the approval email went to **spam**.
Possibility 3 is now confirmed, not just inferred.

## Diagnosis (spec section 1): possibility 3, it was sent

Read from the live admin page for order **KC-2609-48D35**
(`/admin/orders/7ba079e9-cbc6-4901-a6a3-45ff17ea3659`), placed 08:35:

| Timeline row | Outcome | Detail | Time |
|---|---|---|---|
| draw-artwork | ok | front and back plates | 08:37 |
| order-confirmation | ok | 33eaf521-87a3-48ac-aaab-28e5a713deb5 | 08:37 |
| artwork-ready | **ok** | awaiting approval (1 drawn) | 08:37 |

The Email delivery panel also lists **Approval link: sent**, to sebastian@lightningdigital.co.za
at 08:37.

- **Not possibility 1.** The `ok` detail is only written when `ready.ok` is true, and the
  `order_emails` row is only written when Resend returns a message id.
- **Not possibility 2.** The row exists, so the process got past the send. Drawing took about
  two minutes, well inside the function's time limit. The `after()` rework is not needed for
  this order.
- **So it is possibility 3.** Resend accepted the mail and it did not reach the inbox. The
  confirmation, sent seconds earlier to the same address, did arrive.

What this leaves to do:
1. **The approval email lands in spam, and that is now the real problem.** The confirmation,
   sent from the same domain seconds earlier, reached the inbox, so domain authentication
   (SPF/DKIM) is probably not the cause. The difference is likely the content: a short email
   with one button, a long tokenised link, and "This link is yours alone... your account",
   which is how phishing reads. Worth a look before launch: more body text, the portrait
   itself in the email (never built, see `docs/spec-email-testing-6-aug.md`), less
   account-style wording. Check with mail-tester.com or Gmail's "show original". This is a
   copy and design decision for the owner, not a code fix.
2. **Delivery monitoring is blind.** Both mails still read `sent`, including
   the confirmation that arrived, so no Resend delivery event has ever reached
   `/api/webhooks/resend`. Set `RESEND_WEBHOOK_SECRET` in Vercel and add the webhook in
   Resend (the delivered, bounced and complained events).

## Found along the way (not in the spec)

- **Two-portrait orders could never release on their own.** Every upload is its own
  artwork, so a hoodie plus a tee is two drawings, and `releaseApprovedOrder` waits for both.
  But `fulfillPaidOrder` mailed a link for `artworkIds[0]` only. **FIXED** in this commit:
  one mail per portrait. Follow-up: the two mails share a subject and do not say which
  garment each one is for.
- **The approval page shows the wrong back.** In `src/app/approve/[token]/page.tsx`,
  `portraitKey = artwork.frontKey ?? canonicalKey`. `frontKey` is the *finished* front plate,
  so both figures get the colour front plate squeezed into their portrait window, with fresh
  lettering laid on top. The graphite back, which is what prints (`canonicalKey` =
  `backBytes`), is never shown to the customer. **NOT FIXED.** The fix: when `frontKey` and
  `backKey` both exist, show `backKey` in the Back figure and `frontKey` in the Front figure
  as plain images in their print-area boxes. Keep the current composite only for older rows
  that have no plates. The owner will see this on step 1 of the manual checks.
- **The admin order page misled on this order.** The thumbnail read "No art" because
  `previewKey` is no longer written (**FIXED**: it now uses `frontKey ?? previewKey`). The
  Actions panel says "fulfilment has not run" and offers Retry, which would send the
  confirmation again (**NOT FIXED**, see the list below).

## Done and committed

- `resendArtworkReady(orderId)` in `src/lib/fulfillment.ts`, beside `resendJobSheet`:
  - It refuses unless the order is `paid` (`wrong-status:<s>`), and when there are no lines
    (`no-lines`), when any portrait lacks a plate (`not-drawn`), or when nothing is left to
    approve (`already-approved`).
  - It mails every unapproved portrait, draws nothing and sends no receipt.
  - Each send writes a `fulfillment_events` row (`re-sent: <id>`, or
    `re-send failed: <msg>`) and an `order_emails` row.
- Shared `mailApprovalLinks()`, which `fulfillPaidOrder` now uses too. Its detail is now
  `awaiting approval (N drawn): <message id>`, and the log line points to Approvals.
- `resendArtworkReadyAction` in `src/app/admin/(dashboard)/actions.ts`. It checks the admin
  session and revalidates the order page and `/admin/approvals`. Its copy says that "sent" is
  not "arrived".
- `src/lib/admin/orders.ts`: `approvalMailState(events, artworkId?)`,
  `isAwaitingApproval(order, lines)`, and the thumbnail fix.
- `src/lib/admin/approvals.ts`: each row now carries `drawn` and `approvalMail`.
- Tests: 208 pass across fulfilment, admin and admin actions. Eslint is clean on the changed
  files, and there are no type errors in them. `npx tsc` reports older errors in
  BreedPicker.test, email/index.test and order-token.test, which were not touched.

## Status after the second session: all built, not yet deployed

Every code item in the spec is done on `fix/first-real-order`: `npm run build` passes,
the full test suite passes (1280 tests, 1 skipped), and lint has no errors. The one lint
warning, in `welcome.ts`, predates this work. The branch adds no em or en dashes; ten
older ones remain in files this work did not touch.

- Section 0 (approval page): shows `frontKey` and `backKey` as they are, and composes
  nothing. Commit 34d85c5.
- Section 1 (re-send UI): the button is on the Approvals queue and the order page, the
  "was the customer told" line is on both, and a drawn order no longer offers Retry.
  Commit 9d21445.
- Section 2 ("Wear it again"): `GarmentPreview` is shared with the customizer, the back
  plate sits on the chosen garment, and the preview is pinned under the header on phones.
  The shared box now keeps the photograph's shape on both axes; it was cropping landscape
  tees on desktop. Commit 20baad9.
- Section 3 (errors): newsletter, checkout, the checkout form, sign-in and upload.
  Commit 87bb3d8.

Suggested as separate tasks:
- The front chest print file is never sent to the print shop.
- Tee plate placement needs calibrating per colourway.

Still needs the owner:
1. **Merge and deploy.** The manual checks in spec section 4 run against the live site.
2. **Re-send twice on KC-2609-48D35** from Approvals. Expect two `artwork-ready` rows
   reading `re-sent: <id>`, no redraw, and no second receipt. Already seen locally against
   a mock order.
3. **Open the approval link.** You should see one arc and one name on the front, and the
   graphite profile on the back.
4. **Check transparency.** Right-click the back plate on the approval page and open the
   image in a new tab; Chrome shows it on a dark background. A pale rectangle behind the
   animal means the portrait is opaque, and it would print as a patch on every non-white
   garment.
5. **"Wear it again" at phone width.** Switch piece and colour and watch the garment
   change under the plate.
6. The approval email lands in spam, and Resend delivery webhooks are not set up (both
   above).
