# Master Project Board · review and re-sequence

Reviewed 27 July 2026 against the actual codebase and today's work.

---

## 1. Things the board lists as outstanding that are already done

**Phase 2 · Infrastructure is complete.** Every Critical item in that table was cleared
today:

| Board task | Reality |
|---|---|
| Fix Blob storage | Done. Store was created Private, code required public. New public store created and connected. |
| Connect database | Done. `MOCK_SERVICES=true` was overriding `DATABASE_URL` and silently forcing a throwaway database. Removed. |
| Restore Admin Portal | Done. Admin login confirmed working. |
| Image upload testing | Done. Uploads succeed and persist. |
| Checkout testing | Partially. Sandbox PayFast path exists and is tested in code, not yet walked end to end by hand. |
| Product upload pipeline | Needs definition. If this means admin uploading product photography, that surface does not exist yet. |

**Image moderation is already built** (`src/app/api/upload/route.ts` screens every upload
through the provider's moderation endpoint before storing). The board has it in Backlog.
It needs testing with real images, not building.

**Also already built, and absent from the board:** customer accounts, one-click reorder,
order lookup by reference, magic-link login, email bounce monitoring, JSON-LD, sitemap,
robots, llms.txt, and the GA4 integration itself (inert, awaiting a measurement ID).

---

## 2. The thing the board understates, and it matters more than anything else on it

**Taking real money has a three-step external dependency chain, and it is the longest lead
time in the entire project.**

```
Register Pty Ltd (CIPC)  →  Business bank account  →  PayFast Business approval
```

Each step requires the previous one to be finished. None of them are same-day. Realistically
this is weeks, not days, and almost none of it is time you control.

The board has "Open business bank account and PayFast" at priority 6, below website work.
That sequencing is backwards. **Everything on the website can happen while you wait for
paperwork. Nothing about the paperwork can happen faster because the website is polished.**

If the company registration starts tomorrow, the waiting runs in parallel with the build.
If it starts in three weeks, launch moves by three weeks regardless of how good the site is.

**This is the single most valuable change to make to the plan.**

Related: PayFast will want a live site with **published terms, privacy, refund and returns
policies** before approving a merchant account. See section 3.

---

## 3. The real gap: no legal pages exist

The board has these under Phase 6 Launch Checklist. They are not launch polish. They are
a dependency of PayFast approval and a legal requirement for South African e-commerce.

Currently missing entirely, no page exists for any of them:

- Privacy policy
- Terms and conditions
- Refund policy
- Returns policy
- Contact page

**The returns policy needs actual thought, not a template.** Every item is personalised.
Under the ECT Act the standard cooling-off right does not extend to goods made to a
customer's specification, which means you are not obliged to accept "changed my mind"
returns. But you must say so clearly and up front, and you must still handle faulty items,
wrong sizes and printing errors. Get this wrong in either direction and it costs you: too
harsh and you lose trust on a premium product, too loose and you reprint garments for free
on a 24% margin.

Recommended: I draft all five, you review. They are not hard, they are just unwritten.

---

## 4. Conflicts between the board and decisions already made

**"Four animated pets" (Homepage, Medium).** The codebase carries an explicit instruction
not to rebuild pet animations: a cat-swat animation was built three times and deleted by
your own decision on 17 July, with a note saying do not attempt it again without a new
approach. The DeliveryDog and CartDog stay. Either the board item is stale, or you have
changed your mind and we should say so deliberately rather than have an agent rebuild
something you already rejected three times.

**"Shipping (PUDO)" (Operations, Critical).** This one has consequences nobody has costed:

1. **It changes the pricing model.** PUDO locker-to-locker runs roughly R60 against the
   R95 door courier currently in the model. That is about R35 back per order, which is
   real money at a 24% margin on the tee.
2. **It contradicts the copy we shipped today.** The site now says "couriered to your
   door" and "delivered to your door" in several places. PUDO delivers to a locker, and
   the customer collects. If PUDO is the plan, that copy is wrong the day it goes live.
3. **It is a genuine trade-off, not just a saving.** Lockers are cheaper and traceable,
   but a keepsake bought to remember a pet arriving in a parcel locker is a different
   unboxing to one handed to you at your door. For a premium brand that is worth thinking
   about, not just costing.

Decide PUDO versus door courier **before** the pricing lock, because it moves every number.

---

## 5. Things worth adding to the board

- **Sample garments, before pricing.** The board has it as High/Backlog. It should come
  before final prices. You are about to set R599 to R999 price points on garments you have
  never held. One afternoon with a sample of each either confirms the premium positioning
  or tells you the blank is not good enough, and both answers are worth knowing now.
- **OpenAI hard spend cap.** The board says "API cost limits, Critical" and is right. Set
  a hard monthly cap in the OpenAI dashboard on day one. The regen cap of 3 per artwork
  limits normal use, but a hard billing ceiling is the thing that stops a bad afternoon
  becoming a bad invoice.
- **Photography.** Not on the board anywhere. Every image on the site is a placeholder
  whose caption is the shot list. This is the largest remaining gap between a working site
  and a premium brand, and no amount of code closes it.
- **Domain registration.** On the board under Business Formation, correctly noting it
  should be owned by the company. It is currently unregistered and quietly gates GA4,
  transactional email, and launch.

---

## 6. Re-sequenced sprint

The board's order, corrected for lead times and for what is already done.

**Start immediately, because they wait on other people:**

1. Register the Pty Ltd, reserve the name
2. Finalise equity and sign the founders agreement (draft already exists in this folder)
3. Open the business bank account
4. Apply for PayFast Business
5. Register the domain under the company

**Do while waiting, because they only need you:**

6. Order sample garments · decide PUDO versus door courier · then lock prices
7. Legal pages: privacy, terms, refund, returns, contact
8. OpenAI account, key, hard spend cap, then test twenty real photos
9. Shop page above the fold, men's and women's categories
10. Customer journey refinement
11. Photography

**Already done, remove from the board:**

- Fix Vercel, Blob storage and database (sprint item 3)
- Image moderation
- Restore admin portal

**Still true and correctly placed:** sprint item 7, the full customer journey test, upload
through to fulfilment. That remains the single best proof the thing works.
