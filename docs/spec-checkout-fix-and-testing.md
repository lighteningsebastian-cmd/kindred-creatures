# Checkout blocker, and how to test email and the OpenAI path

3 August 2026.

---

## 1. The bug · checkout refuses every order

**`src/app/api/checkout/route.ts` line 219:**

```ts
if (!artwork.style) {
  return bad("Please choose a style for one of these portraits.", 422);
}
```

`artworks.style` is still a column, but **nothing writes to it any more.**
`saveArtworkDetails` dropped the argument when the style choice was removed on 3 August, so
the field is null on every new artwork and the gate rejects every checkout.

### The fix

Remove the gate. There is one house style, so "which style did they choose" is no longer a
question anyone can fail to answer.

- Delete the `if (!artwork.style)` check and its 422.
- Update `src/app/api/checkout/route.test.ts`: the case at line 275, *"refuses a line with
  no style chosen"*, asserts behaviour that should no longer exist. Delete the test rather
  than weakening it, and say why in the commit.
- Leave the **column** in place. Historic artwork carries a real value and
  `src/lib/account/creatures.ts` reads it for reorder. Dropping it is a migration this
  change does not need.
- Grep for other gates on the same field before committing:
  `grep -rn "artwork.style\|\.style\b" src/app src/lib --include=*.ts | grep -v test`

**Verify:** complete a checkout end to end in sandbox. That is the only proof.

---

## 2. Testing the email sequence

Emails go through Resend. With no `RESEND_API_KEY` they are written to the console, which
is why nothing has arrived so far.

**The blocker everyone expects is the domain, and it is avoidable.** Resend lets a new
account send from its own test sender without verifying any domain, on the condition that
it can only deliver to the address the Resend account was registered with. That is exactly
what is needed here: the owner wants to see the emails, not send them to customers.

### Setup

1. Create a Resend account using `lightening.sebastian@gmail.com`
2. Generate an API key
3. In Vercel, add:

| Variable | Value |
|---|---|
| `RESEND_API_KEY` | the key |
| `EMAIL_FROM` | Resend's test sender, from their dashboard |
| `EMAIL_REPLY_TO` | `lightening.sebastian@gmail.com` |
| `PRINT_SHOP_EMAIL` | `lightening.sebastian@gmail.com` for now, so the job sheet is visible too |

4. Redeploy

**Confirm the sending limits in the Resend dashboard before relying on this.** If the test
sender will not do it, the fallback is to register the domain, which is on the list anyway
and gates GA4 and launch as well.

**What to expect:** payment confirmation, then artwork ready, then approved, then shipped.
Every one addressed to the pet by name. The print job sheet arrives at
`PRINT_SHOP_EMAIL`, which is worth reading carefully: it is what Red Hot Prints receives,
and this is the first chance to see whether it is any good.

---

## 3. Testing the OpenAI path

**The key is already live in Vercel.** No further setup.

The thing to understand: **generation happens after payment.** Nothing is drawn in the
browser any more, so there is no button that triggers it. The sequence is:

```
sandbox checkout → PayFast ITN webhook → fulfilment hook → two generations → approval email
```

So to see a real portrait, an order has to complete and the webhook has to arrive.

### The path

1. Fix section 1, or checkout refuses the order
2. Place an order and pay through the PayFast sandbox
3. PayFast posts the ITN to the live site, the webhook verifies it, and generation runs
4. The approval email arrives, and `/approve` shows both plates with a real drawing in them

**If the webhook does not arrive**, `scripts/simulate-itn.ts` is in the repo for exactly
this. It fakes a verified ITN against a known order so fulfilment can be exercised without
PayFast in the loop.

### What to look for, in order of importance

1. **Does the front portrait look like the animal in the photograph?** Everything else is
   secondary.
2. **Is the back a genuine side profile**, or has the model drifted back to face-on? This
   is the known weak point: it is inferring a profile from a face-on photograph, without a
   breed reference, because the library does not exist yet.
3. **Is the background truly transparent?** Save the file and open it over something dark.
   A white box behind the animal prints as a white box on the garment.
4. **Does the plate text survive at full size?** Zoom to 100 percent and read every letter.

**Cost:** two images per order, roughly R7. A dozen test orders is under R100.

---

## 4. Order of work

1. The checkout fix. Nothing else can be tested until an order can be placed.
2. Resend, so the emails are visible.
3. One sandbox order end to end, and look hard at what comes back.

That third step is the first time this product will have been seen working from end to end
with a real drawing in it.
