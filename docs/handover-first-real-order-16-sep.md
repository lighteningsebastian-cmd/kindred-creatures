# Handover: first real order, part-way through

**16 September 2026.** Work against `docs/spec-first-real-order-16-sep.md`, stopped at a
session limit. Read this first, then the spec.

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

Still to do by hand:
1. In the Resend dashboard, search for mail to that address at 08:37 and read the approval
   mail's status (delivered, bounced or delayed). The site did not record its message id; it
   does now (see below).
2. Check spam, and Microsoft 365 or Defender quarantine if lightningdigital.co.za uses it. A
   short mail with one button and "This link is yours alone... your account" looks a lot like
   phishing. That is a guess, not a finding.
3. **Delivery monitoring is blind in production.** Both mails still read `sent`, including
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

## Remaining, in order

1. **UI for the re-send (spec section 1). No button exists yet.**
   - `src/components/admin/OrderActions.tsx`: export a `ResendApprovalMail({ orderId })`
     built like `ResendJobSheet`, using `useActionState(resendArtworkReadyAction)`. Add an
     optional `awaitingApproval` prop. When `concern === "awaiting-print"` and
     `awaitingApproval` is true, say "Drawn and waiting on the customer. Nothing prints until
     they approve." and show `ResendApprovalMail` *instead of* Retry. Add
     `resendArtworkReadyAction` to the `vi.mock` in `OrderActions.test.tsx`.
   - New `src/components/admin/ApprovalMailStatus.tsx`, a server component taking an
     `ApprovalMailState`:
     - never sent: "Approval link never sent. The customer has not been told." (error colour)
     - last attempt failed: the date and detail
     - otherwise: "Sent N times, last <date>", with a note that sent means the provider
       accepted it and the Email delivery panel says whether it arrived.
   - `src/app/admin/(dashboard)/orders/[id]/page.tsx`: pass
     `awaitingApproval={isAwaitingApproval(order, lines)}`, and render
     `ApprovalMailStatus` at the top of the timeline panel when the order is awaiting
     approval or has any `artwork-ready` events.
   - `src/app/admin/(dashboard)/approvals/page.tsx`: render `ApprovalMailStatus` for each
     row, and `ResendApprovalMail orderId={row.orderId}` when `row.drawn` is true (show
     "Still drawing" when it is false).
2. **Fix the approval page** (above).
3. **Reorder preview (spec section 2).** Nothing started. The plan:
   - Lift `GarmentView` out of `LivePreview.tsx` into `src/components/products/GarmentPreview.tsx`
     (not "GarmentView", which clashes with the type in `lib/garments`). Props:
     `{ product, color, side, children }`, where `children` is the plate layer placed inside
     the `PLACEMENT` box. Keep zoom and the `photoAspect` box inside it.
   - LivePreview passes its SVG and stock image as `children`.
   - Reorder passes `<div style={{aspectRatio: back.widthMm/back.heightMm}}><img
     className="absolute inset-0 h-full w-full object-contain"/></div>`. That is contain,
     matching `derivePrintBytes`, so the preview matches what a different product prints.
   - `getReorderableCreature` returns `frontUrl` (`frontKey ?? previewKey`) and `backUrl`
     (`backKey ?? previewKey`). Update the page and `page.test.tsx`.
   - The props become `{ artworkId, styleLabel, frontUrl, backUrl }`. Back is the default,
     with a front toggle. Drop `aspect-square`. The empty state takes the garment's own shape.
   - Watch the page weight: `backKey` is print resolution (about 3000px). The account card
     already serves `frontKey` that way, but a downscaled route would be kinder on phones.
4. **Error messages (spec section 3).**
   - `src/app/api/newsletter/subscribe/route.ts`: wrap `upsertSubscriber` in a try/catch,
     `console.error` the real error, and return a 503 with "Something went wrong on our side.
     Your address is fine; please try again in a few minutes." In `NewsletterSignup.tsx`,
     fall back to that sentence on a response of 500 or above.
   - Same shape in `src/app/api/checkout/route.ts` at about line 188. A database error on the
     artwork lookup returns a 400 "We could not find one of these portraits". Check the
     artwork ids against a UUID pattern first, then return a 503 in the catch.
   - `CheckoutForm.tsx` at about line 427: `await response.json()` throws on an HTML 500, and
     the customer is told to "check your connection". Use `.catch(() => null)`.
   - Softer cases: `LoginForm` shows a server error as a red message under the email field,
     and `/api/upload` does not catch storage or database errors.
5. Verify (spec section 4): `npm run build`, `npx vitest run`, `npm run lint`, the dash grep,
   then the manual checks. Manual step 1 needs a deploy, and the Approvals button from item 1.

When the re-send commit is final, its message must say: **possibility 3 (Resend accepted it;
fulfillment_events artwork-ready ok, order_emails row present; delivery unconfirmed because
the Resend webhook is not configured).**
