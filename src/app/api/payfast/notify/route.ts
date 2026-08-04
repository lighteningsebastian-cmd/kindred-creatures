import { after } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, type Db } from "@/lib/db/client";
import { orders, webhookEvents } from "@/lib/db/schema";
import { fulfillPaidOrder } from "@/lib/fulfillment";
import {
  findOrCreateCustomer,
  claimOrdersForCustomer,
} from "@/lib/account/customers";
import {
  payfastConfig,
  payfastValidateUrl,
  toAmountString,
  verifyItnSignature,
} from "@/lib/payfast";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The PayFast ITN webhook: the only code in this shop that may mark an order
 * paid.
 *
 * Everything else in the payment flow is a request. This is the answer. The
 * customer's browser coming back to a success page proves nothing (they can
 * type that URL), the payment form proves nothing (they can edit it), and so
 * the entire question of "has this been paid for" is settled here, from a
 * payload we have proven came from PayFast and reconciled against the row we
 * wrote at checkout.
 *
 * The order of operations below is load-bearing:
 *
 *   1. Signature. Rejects anyone without our passphrase.
 *   2. Source. Rejects anyone who has our passphrase but is not PayFast.
 *   3. Merchant id. Rejects a payload for somebody else's shop.
 *   4. Record the event. THIS IS THE IDEMPOTENCY GATE, and it deliberately sits
 *      after 1 to 3, not before. webhook_events.payfast_payment_id is unique,
 *      so the first insert of a pf_payment_id wins and every retry after it
 *      short-circuits. If unverified posts were recorded here, anyone could
 *      POST a guessed pf_payment_id, claim that gate, and the real ITN behind
 *      it would be waved through as "already handled" while the order sat
 *      unpaid forever. The gate is only safe once we know who is knocking.
 *   5. Reconcile against the order: it must exist, and the money must match.
 *   6. Transition, guarded in SQL so only a pending order can become paid.
 *
 * Status codes are for PayFast, not for humans: PayFast retries an ITN until it
 * gets a 200, so a 200 means "we have this, stop resending" and anything else
 * means "send it again". That is why a payload we understood but disliked (an
 * unknown order, a mismatched amount, a FAILED payment) still answers 200 with
 * the event on record, and only a payload we could not verify answers 400.
 * Nothing in the body ever says why: a webhook that explains itself to a
 * hostile caller is an oracle for tuning the next attempt.
 */

/** How long PayFast gets to confirm an ITN before we give up and let it retry. */
const VALIDATE_TIMEOUT_MS = 8000;

/** PayFast's answer to a confirmed notification. Anything else is a no. */
const VALID_ANSWER = "VALID";

function ok(): Response {
  return new Response("OK", { status: 200 });
}

/**
 * Malformed or unverifiable. PayFast will retry; a human should look.
 *
 * The reason is logged because every rejection here answers an identical bare
 * 400, and in production that made a PayFast outage, a stale merchant id and a
 * forged post the same event: a 400, a retry, and nothing to tell them apart.
 * The reason names the guard and stops there. Nothing from the payload goes in
 * it, because a payload that failed these guards is unverified input, and the
 * body is only worth keeping once we know who sent it (that is what
 * webhook_events is for, below). The caller still learns nothing: this goes to
 * our logs, not into the response.
 */
function unverifiable(reason: string): Response {
  console.warn(`[payfast] ITN rejected: ${reason}`);
  return new Response("Bad Request", { status: 400 });
}

/** Our fault, not theirs. Non-200 asks PayFast to send this one again. */
function tryAgain(): Response {
  return new Response("Service Unavailable", { status: 503 });
}

/**
 * The posted body as an ordered field map.
 *
 * Order is not cosmetic: PayFast signs the fields in the order it sent them, so
 * the object's insertion order IS the base string's order (see buildSignature).
 * Sorting this, or rebuilding it from a plain object literal, silently breaks
 * every signature.
 *
 * A repeated key is refused rather than resolved. PayFast does not send one,
 * and neither "first wins" nor "last wins" can reproduce a base string that
 * contained both copies, so any answer we picked would be a guess about a
 * payload whose only plausible author is someone hoping we guess wrong.
 */
function parseFields(body: string): Record<string, string> | null {
  const fields: Record<string, string> = {};
  let posted = 0;

  for (const [key, value] of new URLSearchParams(body)) {
    posted += 1;
    fields[key] = value;
  }

  if (posted === 0) return null;
  if (Object.keys(fields).length !== posted) return null;
  return fields;
}

/**
 * Skips the source check. Local only, and deliberately awkward to reach: it
 * needs MOCK_SERVICES on AND a non-production build, because MOCK_SERVICES is a
 * legitimate production toggle elsewhere in this codebase (see db/client) and
 * one stray env var must never be all that stands between a stranger with our
 * passphrase and a paid order.
 */
function sourceCheckSkipped(): boolean {
  return (
    process.env.NODE_ENV !== "production" && process.env.MOCK_SERVICES === "true"
  );
}

/**
 * Source check: PayFast's server confirmation. We post the payload we received
 * straight back to PayFast and require them to answer VALID.
 *
 * WHY THIS AND NOT THE IP ALLOWLIST. PayFast document both. The allowlist means
 * resolving www/sandbox/w1w/w2w.payfast.co.za and matching the caller's IP, and
 * the caller's IP is the problem: this app runs behind a platform proxy, so the
 * socket address is the proxy's and the real client is whatever
 * x-forwarded-for says. That header is a header. Trusting it means trusting the
 * left-most hop a stranger controls; trusting it correctly means knowing
 * exactly how many proxies sit in front of us today and re-checking every time
 * the deployment changes. Get it wrong in one direction and anyone can forge
 * the header past the allowlist, which is worse than no check at all because it
 * looks like a check. Get it wrong in the other and every payment silently
 * stops confirming. The postback sidesteps the entire question: it does not ask
 * where the packet came from, it asks PayFast whether they sent it, over a
 * connection WE opened to a host WE named, authenticated by TLS.
 *
 * WHAT IT COSTS, HONESTLY. It puts a synchronous outbound call on the money
 * path, so PayFast being slow or unreachable means we cannot confirm and must
 * ask for a retry (their retry schedule then absorbs it, which is exactly what
 * it is for). It also proves less than it looks: it proves PayFast has this
 * transaction on file with these values, not that this particular HTTP request
 * came from them. That gap does not matter here, because a replay of a genuine
 * payload is caught by the unique constraint on pf_payment_id and a payload
 * with edited values fails the signature before it ever gets here. Belt (this),
 * braces (signature, unique key, guarded SQL transition, amount reconciliation)
 * is the actual defence; no single one of them is.
 */
async function confirmedByPayfast(body: string): Promise<boolean> {
  try {
    const response = await fetch(payfastValidateUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(VALIDATE_TIMEOUT_MS),
    });

    if (!response.ok) return false;

    // The answer is a bare word, sometimes with trailing whitespace.
    const answer = (await response.text()).trim().split(/\s+/)[0] ?? "";
    return answer.toUpperCase() === VALID_ANSWER;
  } catch {
    // Timeout, DNS, TLS, anything. Unconfirmed is unconfirmed.
    return false;
  }
}

/**
 * True for a unique-constraint violation, and only that. Catching every error
 * as "already handled" would turn a database outage into a shop that answers
 * 200 to every ITN and never records a payment, which is the most expensive
 * possible way to fail.
 */
function isDuplicate(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; current != null && depth < 5; depth += 1) {
    const code = (current as { code?: unknown }).code;
    // 23505: unique_violation. Same code on node-postgres and PGlite.
    if (code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * What we make of an ITN, stored beside the payload. The verbatim body is kept
 * inside `raw` (PayFast's word against ours is a reconciliation question, and
 * the answer has to be the bytes they sent), with our verdict alongside it so a
 * flagged order can be explained months later without re-deriving anything.
 */
type Outcome =
  | "received"
  | "paid"
  | "order-not-found"
  | "amount-mismatch"
  | `ignored-status:${string}`
  | `not-pending:${string}`;

function eventRow(body: string, outcome: Outcome): string {
  return JSON.stringify({ outcome, body });
}

async function recordOutcome(
  db: Db,
  paymentId: string,
  body: string,
  outcome: Outcome,
): Promise<void> {
  await db
    .update(webhookEvents)
    .set({ raw: eventRow(body, outcome) })
    .where(eq(webhookEvents.payfastPaymentId, paymentId));
}

/**
 * Hands fulfilment to next/server's after(), which runs the callback once this
 * response has been flushed.
 *
 * WHY AFTER THE RESPONSE, AND NOT INSIDE IT. Fulfilment generates a print file
 * per line, and that is a call to an image provider measured in tens of seconds.
 * PayFast waits for a 200 and retries when it does not get one, so doing this
 * work inline means the ITN either times out at their end or at the platform's,
 * and a payment that actually cleared turns into a retry storm against a
 * webhook that is already busy generating the same print files. after() breaks
 * that loop at the only place it can be broken: the 200 goes out on the
 * payment, not on the printing.
 *
 * WHY THIS DOES NOT WEAKEN ANYTHING. The order is durably `paid` and the
 * webhook event is on record before this is scheduled, so the callback is not
 * part of the money path at all: it can crash, hang or never run, and the
 * payment still stands, the unique key on pf_payment_id still makes the retry a
 * no-op, and the order simply waits at `paid`. That is a recoverable state with
 * a name and a queue: retryFulfillment() picks it up, and S8's admin screen is
 * the button. The one thing this must never do is throw into the caller, hence
 * both catches. A fulfilment problem is not PayFast's problem to retry.
 */
function scheduleFulfillment(orderId: string): void {
  try {
    after(async () => {
      try {
        await fulfillPaidOrder(orderId);
      } catch (error) {
        // fulfillPaidOrder types its expected failures and flags the order
        // itself, so reaching here means a genuine crash. The order stays paid
        // and retryable; say so loudly rather than losing it silently.
        console.error(
          `[payfast] fulfilment crashed for order ${orderId}; it is still paid and can be retried:`,
          error,
        );
      }
    });
  } catch (error) {
    // after() throws when there is no request scope to be after: a direct call
    // from a script or a unit test, never a real ITN. The order is paid and the
    // retry path exists, so this is a note, not a failure.
    console.error(
      `[payfast] could not schedule fulfilment for order ${orderId}; it is still paid and can be retried:`,
      error,
    );
  }
}

export async function POST(request: Request) {
  let body: string;
  try {
    body = await request.text();
  } catch {
    return unverifiable("body unreadable");
  }

  const fields = parseFields(body);
  if (!fields) return unverifiable("body unparseable");

  // PayFast's id for the transaction, and our idempotency key. Not m_payment_id:
  // that is our order id, and one order can legitimately see more than one
  // payment attempt.
  const paymentId = (fields.pf_payment_id ?? "").trim();
  if (paymentId === "") return unverifiable("no pf_payment_id");

  const config = payfastConfig();

  // (a) Signature. Proves the payload was signed by someone holding our
  // passphrase, and that not a byte of it has been edited since.
  if (!verifyItnSignature(fields, config.passphrase)) {
    return unverifiable("signature mismatch");
  }

  // (b) Source. Proves it was PayFast. See confirmedByPayfast: a signature is
  // not an origin, and the passphrase is a shared secret, not a private key.
  if (!sourceCheckSkipped() && !(await confirmedByPayfast(body))) {
    return unverifiable("not confirmed by PayFast");
  }

  // (c) Merchant. A shop with no merchant id has nothing to compare against and
  // therefore no way to know this payment is even meant for us: fail closed
  // rather than accept a notification we cannot attribute.
  if (config.merchantId === "") return unverifiable("no merchant id configured");
  if ((fields.merchant_id ?? "").trim() !== config.merchantId) {
    return unverifiable("merchant id mismatch");
  }

  const db = await getDb();

  // The gate. First insert of this pf_payment_id wins; everything behind it is
  // a retry of work already done, and does none of it again.
  try {
    await db
      .insert(webhookEvents)
      .values({ payfastPaymentId: paymentId, raw: eventRow(body, "received") });
  } catch (error) {
    if (isDuplicate(error)) return ok();
    return tryAgain();
  }

  // (d) The order. m_payment_id is our order id, minted by /api/checkout.
  const orderId = (fields.m_payment_id ?? "").trim();
  let row;
  try {
    [row] = await db.select().from(orders).where(eq(orders.id, orderId));
  } catch {
    // A malformed uuid never matches a row; it is an unknown order, not a fault.
    row = undefined;
  }

  if (!row) {
    // Signed, confirmed by PayFast, for our merchant id, and against an order
    // we have never heard of. Nothing to flag, so the event is the whole record.
    await recordOutcome(db, paymentId, body, "order-not-found");
    return ok();
  }

  // (e) The money. Compared against the row we wrote at checkout, which is the
  // only number in this system the customer never touched. Checked before the
  // payment_status branch and on purpose: a notification quoting our order with
  // the wrong money on it is worth a human's attention whatever it claims to be.
  if ((fields.amount_gross ?? "").trim() !== toAmountString(row.totalZar)) {
    // Only from pending: an order already moving through fulfilment must not be
    // dragged backwards by a stray notification.
    await db
      .update(orders)
      .set({ status: "flagged" })
      .where(and(eq(orders.id, row.id), eq(orders.status, "pending")));
    await recordOutcome(db, paymentId, body, "amount-mismatch");
    return ok();
  }

  // Compared exactly, with no trimming and no case folding. Everywhere else in
  // this file whitespace is forgiven, because an identifier or a numeric string
  // means the same thing with a space on it and flagging a real customer's real
  // payment over one would be absurd. This field is different: it is the field
  // that decides whether money moved, so " complete " is not a near-miss to be
  // helpfully rounded up, it is a value PayFast does not send and that we
  // therefore do not understand. Not understanding it leaves the order pending
  // with the payload on record, which a human can fix. The other direction pays
  // out an order on a string we guessed at.
  const paymentStatus = fields.payment_status ?? "";

  if (paymentStatus !== "COMPLETE") {
    // FAILED, CANCELLED, PENDING, or something PayFast added since. None of
    // them is payment, so the order stays exactly where it is. Sliced because
    // it is caller-supplied text on its way into a column.
    await recordOutcome(
      db,
      paymentId,
      body,
      `ignored-status:${paymentStatus.slice(0, 32)}`,
    );
    return ok();
  }

  // The transition. The status guard is in the WHERE clause rather than in an
  // if-statement above it, so the check and the write are one atomic step: two
  // ITNs racing on the same order cannot both read "pending" and both write.
  // The unique key already makes the identical retry a no-op; this makes a
  // second, DIFFERENT notification for an order that is already paid a no-op
  // too, and keeps the payment id of whichever one actually paid for it.
  // .returning() takes no column list: Db is a union of the PGlite and
  // node-postgres builders (see db/client) and only the bare overload is common
  // to both. We want the row count, not the columns.
  const transitioned = await db
    .update(orders)
    .set({ status: "paid", payfastPaymentId: paymentId })
    .where(and(eq(orders.id, row.id), eq(orders.status, "pending")))
    .returning();

  const paid = transitioned.length === 1;

  await recordOutcome(
    db,
    paymentId,
    body,
    paid ? "paid" : `not-pending:${row.status}`,
  );

  // Auto-account on payment (D3): the buyer paid against this email, which is
  // the same proof of ownership the magic link asks for, so the account exists
  // from the moment the money clears even if they never return from PayFast.
  // Server-side only: no cookie, no session, nothing leaves this process; the
  // one-time welcome token on the return_url is the only thing that can turn
  // this account into a signed-in browser. Best-effort by design: the order is
  // durably paid above, and an account hiccup must never turn a cleared
  // payment into a non-200 and a retry storm.
  if (paid) {
    try {
      const customer = await findOrCreateCustomer(row.email);
      await claimOrdersForCustomer(customer.id, row.email);
    } catch (error) {
      console.error(
        `[payfast] could not attach an account to paid order ${row.id}; the payment stands and the claim reruns on the customer's next sign-in:`,
        error,
      );
    }
  }

  // Only the notification that actually paid the order fulfils it. A duplicate
  // never gets here (the unique key stops it) and a second, different
  // notification for an already-paid order loses the guarded transition above,
  // so neither can put a second job sheet in the print shop's inbox.
  if (paid) scheduleFulfillment(row.id);

  return ok();
}
