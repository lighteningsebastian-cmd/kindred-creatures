# Go-live readiness · 6 August 2026

Where the code is, what actually blocks what, and the checklist we work through together.

---

## 1. The state of the code

**Verdict: the software is not what is holding this up.**

- 28 pages, 12 API routes, ~272 files, ~40,000 lines, 96 test files.
- The whole customer path exists: shop → profile → preview → cart → checkout → PayFast →
  webhook → generation → approval → admin → job sheet → shipping.
- Legal pages exist (privacy, terms, shipping and returns, contact) with `TODO(owner)`
  blocks where facts are still unknown, and tests that fail if the TODOs are quietly dropped.
- Since the 5 August review, Claude Code has also done a full pass on print visibility across
  the shop and home page: the print is now large enough to actually read, cards open the
  print they are selling, and colour controls sit where the shots vary by colour.
- Working tree clean. Nothing half-finished.

**One code change is still outstanding and it is the keystone** — see section 5.

---

## 2. The thing to understand before planning anything

**Two chains have been treated as one, and they are independent.**

```
CHAIN A · get a printed garment into your hands
   artwork at print resolution → The Blank Brand → Red Hot Prints → look at it

CHAIN B · take money from strangers
   PayFast account → bank confirmation → FICA → approval
```

**Chain A needs nothing from Chain B.** No PayFast, no company, no bank account, no live
domain. A print file is a PNG. You can hand it to Red Hot Prints on a memory stick.

That matters because Chain A is the one that answers the questions only a physical object can
answer: is the plate the right size on a real chest, does the graphite read on a White hoodie,
is 110 × 150mm too small, does the arc curve the way it did on screen. **Those answers
change the product.** Chain B changes nothing about the product; it only decides when you can
charge for it.

So run them in parallel, and if you only have energy for one this week, run Chain A.

---

## 3. Chain B is much shorter than we thought

The list has carried "company registration → business bank account → PayFast Business" for
weeks. That is not required.

PayFast offers an **Individual / Sole Trader** account, explicitly for traders and sole
proprietors **not registered with CIPC**. To verify it you need:

- Your SA green barcoded ID or smart ID card, **both sides**, scanned properly
- Proof of residential address, **less than three months old** (utility bill or retail
  statement)
- A **bank account confirmation letter** — account holder's name, account number, bank's
  official stamp. Your existing personal account qualifies.

That is three documents you either have or can get from your bank this week. Company
registration comes off the critical path entirely.

**This is not advice to skip forming a company.** There are real reasons to have one —
limited liability, cleaner tax, a brand that owns its own name, and it will matter more once
there is revenue. It is a decision to make deliberately with an accountant, not a gate that
has to be passed before you can sell anything. Get the sole trader account now; form the
company when it earns its keep.

---

## 4. Rerouting the print shop · already built, zero code

You asked to intercept orders so nothing goes to the printer automatically. **That already
works the way you want.**

`sendJobSheet` reads `PRINT_SHOP_EMAIL`. Set it to your own address and every job sheet comes
to you. You read it, decide, and forward to Red Hot Prints by hand.

```
PRINT_SHOP_EMAIL=lightening.sebastian@gmail.com
```

**Set it to yourself rather than leaving it unset.** Unset, the order still advances to
`sent_to_printer` and logs a loud "the print shop has NOT been told" error — the state and
reality diverge. Set to you, the state is honest: for now, you *are* the print shop.

The admin order page already carries a download link for each print file, and there is a
re-send action if a job sheet fails. Nothing needs building here.

---

## 5. The one code change that unlocks everything else

`docs/spec-email-testing-6-aug.md`, written and not yet built. Two parts:

**Split `MOCK_SERVICES`.** One env var currently switches seven systems. The only reason
`simulate-itn.ts` needs it is to skip PayFast's server-confirmation postback — but flipping
it also swaps OpenAI for a mock SVG and Resend for `console.log`. So the only tool that can
drive a paid order without PayFast cannot test artwork or email. Giving the ITN source check
its own dev-only flag fixes that.

**Put the artwork in the approval email.** There is currently no image in it at all.

**Why this is the keystone.** With the flag split you can drive a complete order on your
laptop, with real generation and real email, and no PayFast anywhere. That gives you, in one
command:

- the four emails, in your inbox, to read as a customer
- the approve and reject flows, exercised
- **a real print file, downloadable from admin** — which is Chain A's input

One change, both chains fed. Do this before anything else on the code side.

---

## 6. The checklist

### This week · yours

- [ ] **Register `kindredcreatures.co.za`.** Roughly R100 a year. Gates the live site,
      real email, GA4 and PayFast's review. Cheapest unlock on the list.
- [ ] **Generate a fresh Resend API key.** The one pasted into chat should be revoked; if it
      was, there is currently no key, so every email is silently going to a console log.
- [ ] **Verify the domain in Resend** (DNS records in your registrar). This removes the
      "only your own address" restriction entirely.
- [ ] **Start the PayFast Individual/Sole Trader application.** Three documents, section 3.
- [ ] **Request a bank confirmation letter.** Usually same-day in a branch or from the app.
- [ ] **Get a print quote from Red Hot Prints**, and ask the two questions that are still
      open: what resolution they want, and how they handle dark garments (that decides
      whether we build the light-ink plate).
- [ ] **Order one hoodie and one tee, both White**, from The Blank Brand. Hoodie blank was
      quoted around R450.

### This week · Claude Code

- [ ] **Build `docs/spec-email-testing-6-aug.md`** — the flag split and the email artwork.
      Everything else waits behind it.
- [ ] Fill the `TODO(owner)` blocks on the legal pages once you have the trading name and
      address.

### Once the flag split lands · together

- [ ] Run one full order locally with real services. Read all four emails.
- [ ] Approve one. Confirm the job sheet arrives at your address and reads well enough for a
      print shop to work from.
- [ ] Reject one. Confirm the second drawing and the second email.
- [ ] Download the print files from admin.
- [ ] Open a print PNG over a dark background. Confirm real transparency, not white pixels.

### Then · Chain A, the physical test

- [ ] Take the print files to Red Hot Prints. One hoodie front and back, one tee.
- [ ] Look at the result and answer: is 110 × 150mm right on the chest? Does graphite read on
      White? Is the plate text sharp? Does the arc sit right?
- [ ] **Photograph the printed garment.** That photograph is worth more than anything else on
      this list: it is the first real proof, the first honest product shot, and the first
      thing a customer will believe.

### Then · Chain B, go live

- [ ] Deploy to the live domain, all env vars set, `MOCK_SERVICES` unset.
- [ ] PayFast approval, switch from sandbox to live credentials.
- [ ] One real order, your own card, smallest item.
- [ ] GA4 with the domain in place.

### Not blocking, but tracking

- The 113-image breed reference library does not exist. Every back profile is inferred from
  a face-on photo. This is the biggest remaining product gap.
- The tee shoot is inconsistent — White is portrait, Heritage Blue and Olive are landscape.
  A recrop, not code.
- The tote has no price and no photography. Decide whether it launches or is pulled.
- The dark-colourway light-ink plate, waiting on the printer's answer.
- Your prompt revision, and the reference-only `SUBJECT` clause after it.

---

## 7. What this costs to find out

Roughly, and most of it is the garments:

| | |
|---|---|
| Domain | ~R100 / year |
| Vercel, Resend, PayFast, Neon | R0 on their free tiers at this volume |
| OpenAI so far | about R15 spent |
| Two blank garments | ~R700 |
| Printing, two garments | unquoted — ask |
| **To a printed garment in your hands** | **under R1,000** |

Nothing here needs money you have to raise. The expensive thing on this project has never
been the cash; it is the evenings, and the way to protect those is to stop running the two
chains in sequence.
