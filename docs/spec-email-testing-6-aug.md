# Spec: make the email and approval pipeline testable

**For Claude Code.** The owner needs to see the four emails arrive, look at the artwork, and
exercise approve and reject. Today none of that is possible, and the reason is one env var
doing seven jobs.

Two changes. Section 1 unblocks the testing. Section 2 is a product decision the owner has
made and it changes what the approval mail contains.

**Do not touch `src/lib/images/prompts.ts`.**

---

## 1. `MOCK_SERVICES` is one switch wired to seven things

`scripts/simulate-itn.ts` is the tool for driving a paid order without PayFast. Its header
says it needs `MOCK_SERVICES=true`, and it does — but only for one narrow reason:
`sourceCheckSkipped()` in `src/app/api/payfast/notify/route.ts` line 123, which skips posting
the notification back to PayFast for confirmation. PayFast has never heard of a simulated
ITN, so without that skip the webhook correctly returns 400.

The problem is what else that flag switches off. Every one of these reads it:

| File | What `MOCK_SERVICES=true` does |
|---|---|
| `src/lib/db/client.ts` | Postgres off, PGlite instead |
| `src/lib/storage.ts` | Vercel Blob off, local disk instead |
| `src/lib/images/index.ts` | **OpenAI off, mock SVG instead** |
| `src/lib/email/send.ts` | **Resend off, console instead** |
| `src/lib/payfast.ts` | PayFast config treated as absent |
| `src/lib/newsletter/index.ts` | Newsletter provider mocked |
| `notify/route.ts` | The ITN source check skipped |

The two in bold are exactly what the owner is trying to test. **The only tool for driving the
pipeline without PayFast is structurally incapable of testing the two things worth testing.**
That is the whole bug, and it has cost several evenings.

### The fix: give the source check its own flag

Add a dedicated, dev-only variable — `PAYFAST_TRUST_UNVERIFIED_ITN` or similar; name it so
nobody could mistake it for something to set in production.

```ts
function sourceCheckSkipped(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    (process.env.PAYFAST_TRUST_UNVERIFIED_ITN === "true" ||
      process.env.MOCK_SERVICES === "true")
  );
}
```

**Keep the `NODE_ENV !== "production"` guard exactly as it is.** The docstring's reasoning
stands and is good: one stray env var must never be all that stands between a stranger with
our passphrase and a paid order. This change adds a second key to the same lock, it does not
weaken the lock. Keep `MOCK_SERVICES` working too, so nothing that relies on it breaks.

Then update the usage block at the top of `scripts/simulate-itn.ts`: the new flag is what it
needs, `MOCK_SERVICES` is what it must **not** have set if the point is to see real artwork
and real email. Say that in the header, in the same plain voice the rest of that file uses,
because the next person to read it will be the owner.

**What this unlocks.** On localhost with `OPENAI_API_KEY` and `RESEND_API_KEY` set and
`MOCK_SERVICES` unset, one command drives a real order through real generation and real
delivery, with PayFast absent entirely. Storage falls back to `LocalStorageAdapter` (disk,
served through `/api/asset/[...key]`), which is correct for this and needs no Blob token.

It also sidesteps PayFast sandbox's "merchant is unable to receive payments from the same
account" refusal, because there is no PayFast in the loop. The owner can use his own address
as the order email, which is the only address Resend's test sender will deliver to.

---

## 2. The approval email has no artwork in it

`src/lib/email/templates/approval.ts` contains no `<img>` anywhere. Both
`approvalReadyEmail` and `revisionReadyEmail` are a heading, two paragraphs and a button to
`/approve/{token}`.

**Owner decision: the artwork goes in the email.** That mail is the moment the commission
arrives, and asking someone to click through to find out what they bought spends the moment
on a page load.

### How to do it without it rotting

The naive version puts a signed storage URL in the `src`. Do not do that. Signed URLs expire
in an hour and an email is read whenever it is read; a broken image in **this** email is
worse than no image, because it lands at the exact moment the customer is deciding whether we
are real.

**Use the pattern Claude Code just built for the cart.** `/api/artwork/[id]/plate` is a
stable path that renders per request and never rots. Do the same here: a stable route that
re-signs or re-renders on every hit, so a mail opened in a week still shows a picture.

- The route must be **authorised by the same signed order token the approval link carries**,
  not by artwork id alone. An unguessable-uuid image endpoint is not authorisation, and this
  one is going into an email that gets forwarded.
- Serve the **front plate**: colour, a face, legible in a small inbox preview. The back is
  large, monochrome and typeset for a garment, not a thumbnail.
- Constrain the width in the HTML (roughly 480px) and set a real `alt` — most clients block
  images by default, so the alt text is what a meaningful share of customers will actually
  read. It should say what the picture is, not "portrait".
- **The button and the link stay.** The image is an addition, never a replacement: it is
  blocked often enough that a mail whose only content is an image is a blank mail.
- The plain-text half is unchanged. It already carries the URL.

Do both templates. `revisionReadyEmail` is arguably the more important of the two: someone
who has already said "this is not right" should see the new attempt without another click.

---

## 3. Verify

```
npm run build
npx vitest run
npm run lint
```

Then, and this is the part that matters, leave the owner a short runbook at the top of
`scripts/simulate-itn.ts` or in `docs/`: the exact env vars to set, the exact command, and
what should land in his inbox. He is not going to reconstruct this from a diff.

The manual pass is his to run, not yours: place an order, simulate the ITN, and check that
the confirmation and approval mails both arrive, that the approval mail shows the artwork,
that approving releases the job sheet, and that "something is not quite right" produces a
second drawing and a second mail.
