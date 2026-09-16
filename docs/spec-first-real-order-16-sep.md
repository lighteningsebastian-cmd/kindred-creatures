# Spec: what the first real order exposed

**For Claude Code.** 16 September 2026. The database is live on Neon, email sends from
`kindredcreatures.co.za`, and an order was placed and paid for on the live site. Two things
broke, and one of them is the reason the order is stuck.

Owner's report: the order confirmation email arrived. **The approval email with the portrait
did not.** The artwork exists and is visible in the account. Separately, "Wear it again"
shows the drawing but never shows the garment.

**Do not touch `src/lib/images/prompts.ts`.**

---

## 0. The approval page composites an already-composited plate · do this first

**The customer is approving something that is not what will be printed.** That is the exact
failure `docs/spec-portrait-prompting.md` section 1 exists to prevent, arriving from a
direction nobody was watching.

### What the owner sees

On `/approve/[token]`, the front plate shows `KINDRED CREATURES` twice, one arc above
another, and the pet's name twice. The back plate's portrait slot holds a colour, face-on
picture that itself carries an arc and a name — where a graphite side profile belongs.

### It is not the prompt, and prompts.ts must not be touched for it

`CONSTRAINTS` forbids text and lettering and it is working. No model drew those words. Every
duplicated element is one we typeset ourselves, rendered twice.

### The cause, exactly

`src/app/approve/[token]/page.tsx` line 62:

```ts
const portraitKey = artwork.frontKey ?? artwork.canonicalKey;
```

**`frontKey` is not a portrait. It is the finished front plate.** `src/lib/artwork-drawing.ts`
line 139 writes it as `plates/{artworkId}/front-{stamp}.png` — the output of `composePlate`,
with the arc, the portrait and the name already burned in.

The page then builds a fresh `frontPlate()` and `backPlate()` type layer and drops that
finished plate into the portrait rectangle of **both**. So the front is our arc wrapped
around their arc, and our name under their name; and the back gets the colour front plate
where its graphite profile should be.

The comment above that line carries the stale assumption that caused it: *"frontKey and
backKey are written once generation moves after payment; until then the canonical portrait
stands in for both sides."* Whoever wrote it read `frontKey` as a bare portrait. Once
generation moved after payment, it stopped being one, and the fallback was never revisited.

### The fix

**Stop compositing on this page.** `frontKey` and `backKey` are the finished artwork. Show
them as images and nothing else.

- Render `artwork.frontKey` for the front and `artwork.backKey` for the back, each as a
  signed URL, at the right aspect ratio.
- Delete the `frontPlate()` and `backPlate()` calls from this page. There is no type layer to
  build: it is already in the bytes.
- Keep a graceful empty state for an artwork where either key is missing, but do **not**
  fall back to re-compositing. A missing plate is "not ready yet", not "draw a different one".
- Check `canonicalKey` for the same misreading anywhere else:
  `grep -rn "frontKey\|backKey\|canonicalKey" src/app src/lib --include=*.ts --include=*.tsx | grep -v test`

**The print files are probably fine.** `drawArtworkPlates` composites once, correctly, and
stores those bytes; `generatePrintFilesForOrder` resizes them. Confirm that before
celebrating — download a print file for the affected order and look at it. If the print file
is clean and only the approval page is wrong, then nothing has been printed wrongly and this
is a display bug caught in time. Say which in the commit.

### Two things in the same screenshot, worth checking while you are in there

**The portrait has a visible rectangular edge**, so its background may not be truly
transparent. `background: "transparent"` is requested in the provider, but this is the first
real chance to check it against a real file rather than a mock. Open a stored portrait over
a dark background and confirm real alpha. If it is opaque, that prints as a pale rectangle on
every garment that is not white — which is most of the range.

**The plate said `DOMESTIC LONGHAIR` / `Felis catus` over a photograph of a Labrador.** That
is the owner's own test data, not a fault. But it shows the plate will contradict the picture
without a murmur. Not a bug to fix now; worth knowing before somebody's plate says the wrong
species in print.

---

## 1. The approval email did not arrive · this is blocking a paid order

### What we know

The confirmation and the approval mail are sent **in the same function, seconds apart,
through the same transport** — `fulfillPaidOrder` in `src/lib/fulfillment.ts`, the
confirmation at line 466 and `sendArtworkReady` at line 476. The first landed. The second
did not. Generation succeeded, so everything before both sends worked.

That narrows it to three possibilities, and they are distinguishable:

1. `sendArtworkReady` returned `ok: false` — Resend rejected or errored on that specific
   message.
2. The `after()` callback was killed between the two sends. Generation takes minutes, and
   `after()` runs on borrowed time after the webhook has already responded.
3. It sent and landed in spam.

### Find out which, before changing anything

The code already records the answer. Do not skip this step and do not guess.

- **`fulfillment_events`** has a row with `step = 'artwork-ready'` and `status` of `ok` or
  `failed`, written at `fulfillment.ts:482`. If it says `failed`, the `detail` column holds
  Resend's error message and possibility 1 is confirmed. If the row is **absent entirely**,
  the process died before reaching it and possibility 2 is confirmed.
- **`order_emails`** has the same answer from the other side, via `recordOrderEmailSend`.
- **Vercel runtime logs** will carry the loud line at `fulfillment.ts:493`:
  `has artwork but the approval mail did not send`. Its presence means the code got there
  and the send failed; its absence means the process never reached it.

Report which of the three it was in the commit message. The fix below is worth doing
regardless, but the cause changes what else needs doing.

### The gap that is certain, whatever the cause

**There is no way to re-send the approval email.** `src/lib/fulfillment.ts` has
`resendJobSheet` for the print shop, and `src/app/admin/(dashboard)/actions.ts` exposes it
as `resendJobSheetAction`. There is **no equivalent for the mail that carries the approval
link**.

The code's own error message says *"Re-send from the admin queue."* That instruction is
false. The action does not exist. So when this mail fails, a paid order is stuck
permanently, the customer has heard nothing, and the only route out is the database.

That is the worst failure mode in the system: the mail that fails is the one without which
nothing else can happen.

**Build it, mirroring the job-sheet re-send exactly.**

- A `resendArtworkReady(orderId)` in `src/lib/fulfillment.ts`, next to `resendJobSheet` and
  built the same way. The reasoning in `resendJobSheet`'s docstring applies unchanged and is
  worth re-reading: it lives in the fulfilment module rather than the admin action **so that
  every mail to a customer leaves a `fulfillment_events` row behind**. A re-send that
  reached past this module would be the one approval mail in the order's history with no
  breadcrumb, which is precisely the one somebody will later need to find.
- Refuse unless the order is `paid` and every artwork on it has `frontKey` and `backKey`.
  Re-sending an approval link for artwork that does not exist is worse than silence.
- Do **not** re-generate anything. This re-sends a mail; the plates are already drawn.
- Expose it as an action and put the button on the **approvals queue**
  (`src/app/admin/(dashboard)/approvals/page.tsx`), which already lists exactly the orders
  in this state. That list is where somebody looks when an order has gone quiet.
- Show the send state on the order timeline so it is obvious whether the customer has ever
  actually been told.

### If the cause turns out to be the `after()` window (possibility 2)

Then the re-send button is a plaster, not the fix, and this will recur on every order. Say
so plainly rather than closing the ticket. The real fix is to stop doing minutes of
generation inside a callback that is already living past its request, but **do not start
that rework in this pass** — write up what you found and what you would change, and let the
owner decide. A recurring failure with a working manual recovery is a business that can
trade; a half-finished queue rewrite is not.

---

## 2. "Wear it again" shows the portrait but never the garment

`src/components/products/ReorderFlow.tsx`.

The component takes exactly three props — `artworkId`, `styleLabel`, `previewUrl` — and
renders `previewUrl` into a square box at line 93 as a bare `<img>`. The product, colour and
size pickers sit beside it and change **nothing that is visible**. Choose the hoodie, choose
Blue, and the picture does not move: it is the portrait floating on a tinted square, with no
garment anywhere.

So the customer picks a hoodie and is shown something that is not a hoodie. On a page whose
whole proposition is "see it on something new", that is the page failing at its one job.

**The fix is to reuse what already works.** `LivePreview`'s `GarmentView` composites a plate
over `garmentImageUrl(slug, color, side)` with `PLACEMENT` from `src/lib/garments.ts`, and
it is correct, tested and now has zoom. Reorder should render the same thing.

Points to get right:

- **The garment photograph must follow the pickers.** Changing product or colour changes the
  photograph underneath. That is the entire point of the screen.
- **`photoAspect()` is per colourway, not per product** — the note above `PLACEMENT` explains
  why. The box has to be the photograph's own shape or the plate measures itself against
  letterboxing and lands off the garment.
- The square `aspect-square` box at line 81 goes. It was sized for a floating portrait.
- **Show the back.** The plate is what they are buying again, and the back is where it lives.
  Offer the front toggle if it is cheap, but the back is the default here.
- The existing `previewUrl` fallback text ("Your portrait") should become a garment-shaped
  empty state, not a square one.

**Prefer lifting `GarmentView` into something both screens import over copying it.** Two
copies of plate placement is how the two screens drift apart, and placement is the thing
that must never be wrong.

---

## 3. Carried over: a database failure reads as a signup failure

From the last pass and still worth doing. `src/app/api/newsletter/subscribe/route.ts` does
not catch database errors, so an unreachable database reaches the customer as *"We could not
sign you up. Please try again."*

That sentence cost two debugging sessions pointed at the wrong system. A rejected email
address and a database outage must not produce the same message. Catch it, return a 503 with
an honest "something on our side" message, and log the real error.

Worth a look for the same shape elsewhere: any route where an infrastructure failure is
presented to the customer as their mistake.

---

## 4. Verify

```
npm run build
npx vitest run
npm run lint
```

By hand, and none of this can be checked by reading code:

1. On the stuck order, use the new re-send and confirm the approval mail arrives, that the
   link works, and that a `fulfillment_events` row records it.
2. Re-send twice. The second must not draw anything, must not charge anything, and must
   leave its own row.
3. Open "Wear it again" on a saved portrait. Switch product and switch colour. The garment
   changes underneath the plate both times, and the plate stays on the chest.
4. Do it at mobile width. The preview must not push the pickers off the screen.
