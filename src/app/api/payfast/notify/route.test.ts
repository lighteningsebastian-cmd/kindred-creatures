// @vitest-environment node
import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { POST as notify } from "./route";
import { getDb } from "@/lib/db/client";
import {
  customers,
  orders,
  webhookEvents,
  type OrderStatus,
} from "@/lib/db/schema";
import { buildSignature } from "@/lib/payfast";

/**
 * The money path. Every test here is a thing that has actually gone wrong at
 * somebody's shop: a replayed notification charging twice, an edited amount
 * paying an order it did not cover, a browser redirect mistaken for a receipt.
 *
 * No test in this file touches the network. The source check is skipped by
 * MOCK_SERVICES (which is only allowed to skip it outside production), and the
 * tests that do exercise the check stub fetch and assert on what it was handed.
 */

/**
 * The route now hands fulfilment to next/server's after(), which needs a live
 * request scope that a direct call to POST does not have. Fulfilment is queued
 * here and never run: these tests are about what the webhook does to the order
 * and the event log, and route.fulfillment.test.ts covers what happens once the
 * response is out the door.
 */
const { afterTasks } = vi.hoisted(() => ({
  afterTasks: [] as (() => unknown)[],
}));

vi.mock("next/server", () => ({
  after: (task: () => unknown) => {
    afterTasks.push(task);
  },
}));

const MERCHANT_ID = "10000100";
const PASSPHRASE = "jt7NOE43FZPn";
const TOTAL_ZAR = 998;

beforeEach(() => {
  afterTasks.length = 0;
  vi.stubEnv("MOCK_SERVICES", "true");
  vi.stubEnv("PAYFAST_MERCHANT_ID", MERCHANT_ID);
  vi.stubEnv("PAYFAST_MERCHANT_KEY", "46f0cd694581a");
  vi.stubEnv("PAYFAST_PASSPHRASE", PASSPHRASE);
  vi.stubEnv("PAYFAST_SANDBOX", "true");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** A pending order, written the way /api/checkout writes one. */
async function pendingOrder(
  totalZar = TOTAL_ZAR,
  email = "thandi@example.co.za",
): Promise<string> {
  const db = await getDb();
  const id = randomUUID();
  await db.insert(orders).values({
    id,
    status: "pending",
    email,
    firstName: "Thandi",
    lastName: "Mokoena",
    phone: "082 123 4567",
    addressLine1: "14 Loop Street",
    suburb: "Gardens",
    city: "Cape Town",
    province: "Western Cape",
    postalCode: "8001",
    subtotalZar: 899,
    shippingZar: 99,
    totalZar,
  });
  return id;
}

async function readOrder(id: string) {
  const db = await getDb();
  const [row] = await db.select().from(orders).where(eq(orders.id, id));
  return row;
}

async function eventsFor(paymentId: string) {
  const db = await getDb();
  return db
    .select()
    .from(webhookEvents)
    .where(eq(webhookEvents.payfastPaymentId, paymentId));
}

/** The outcome the webhook recorded beside a notification. */
async function outcomeOf(paymentId: string): Promise<string | undefined> {
  const [event] = await eventsFor(paymentId);
  return event ? JSON.parse(event.raw).outcome : undefined;
}

let nextPaymentId = 1000000;

/**
 * An ITN as PayFast sends one: field order first, signature last, signed over
 * exactly what precedes it. Overrides are applied BEFORE signing, so a test
 * that edits an amount gets a genuinely valid signature over a wrong number,
 * which is the interesting case. Testing an edited amount with a stale
 * signature would only re-test the signature.
 */
function itn(
  orderId: string,
  overrides: Record<string, string> = {},
  passphrase: string | undefined = PASSPHRASE,
): Record<string, string> {
  const fields: Record<string, string> = {
    m_payment_id: orderId,
    pf_payment_id: String((nextPaymentId += 1)),
    payment_status: "COMPLETE",
    item_name: "Kindred Creatures order",
    amount_gross: "998.00",
    amount_fee: "-22.94",
    amount_net: "975.06",
    name_first: "Thandi",
    name_last: "Mokoena",
    email_address: "thandi@example.co.za",
    merchant_id: MERCHANT_ID,
    ...overrides,
  };
  // keepEmpty: this helper is PayFast, and PayFast signs empty fields as key=.
  return {
    ...fields,
    signature: buildSignature(fields, passphrase, { keepEmpty: true }),
  };
}

function post(fields: Record<string, string>): Request {
  return new Request("http://localhost/api/payfast/notify", {
    method: "POST",
    body: new URLSearchParams(fields).toString(),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
}

describe("POST /api/payfast/notify: a payment that clears", () => {
  it("moves a pending order to paid and records the payment id", async () => {
    const orderId = await pendingOrder();
    const fields = itn(orderId);

    const response = await notify(post(fields));
    expect(response.status).toBe(200);

    const row = await readOrder(orderId);
    expect(row.status).toBe("paid");
    // PayFast's id for the transaction, not our order id.
    expect(row.payfastPaymentId).toBe(fields.pf_payment_id);
    expect(row.payfastPaymentId).not.toBe(orderId);

    expect(await outcomeOf(fields.pf_payment_id)).toBe("paid");
  });

  it("keeps the posted body verbatim on the event", async () => {
    const orderId = await pendingOrder();
    const fields = itn(orderId);
    await notify(post(fields));

    const [event] = await eventsFor(fields.pf_payment_id);
    const stored = JSON.parse(event.raw).body;
    // Byte for byte: reconciling our word against PayFast's is only possible
    // against what they actually sent.
    expect(stored).toBe(new URLSearchParams(fields).toString());
    expect(stored).toContain(`pf_payment_id=${fields.pf_payment_id}`);
  });
});

describe("POST /api/payfast/notify: replays and repeats", () => {
  it("changes nothing when the identical ITN is delivered again", async () => {
    const orderId = await pendingOrder();
    const fields = itn(orderId);

    const first = await notify(post(fields));
    const second = await notify(post(fields));
    const third = await notify(post(fields));

    // PayFast retries until it gets a 200, so every one of these must be a 200.
    expect([first.status, second.status, third.status]).toEqual([200, 200, 200]);

    const row = await readOrder(orderId);
    expect(row.status).toBe("paid");
    expect(row.payfastPaymentId).toBe(fields.pf_payment_id);

    // One notification, one row. The unique key is the whole mechanism.
    expect(await eventsFor(fields.pf_payment_id)).toHaveLength(1);

    // And one fulfilment. Three ITNs must not mean three print files.
    expect(afterTasks).toHaveLength(1);
  });

  it("does not re-process an order that is already paid", async () => {
    const orderId = await pendingOrder();
    const first = itn(orderId);
    await notify(post(first));

    // A second, DIFFERENT notification for the same order: past the unique key,
    // so only the guarded transition stands between it and a double-process.
    const second = itn(orderId);
    expect(second.pf_payment_id).not.toBe(first.pf_payment_id);

    const response = await notify(post(second));
    expect(response.status).toBe(200);

    const row = await readOrder(orderId);
    expect(row.status).toBe("paid");
    // The payment id of whichever one actually paid for it, not the last to arrive.
    expect(row.payfastPaymentId).toBe(first.pf_payment_id);
    expect(await outcomeOf(second.pf_payment_id)).toBe("not-pending:paid");

    // The second notification lost the guarded transition, so it fulfils
    // nothing: one job sheet, not two.
    expect(afterTasks).toHaveLength(1);
  });

  it.each<OrderStatus>(["sent_to_printer", "printed", "shipped"])(
    "does not drag an order back from %s",
    async (status) => {
      const orderId = await pendingOrder();
      const db = await getDb();
      await db
        .update(orders)
        .set({ status, payfastPaymentId: "original" })
        .where(eq(orders.id, orderId));

      const response = await notify(post(itn(orderId)));
      expect(response.status).toBe(200);

      const row = await readOrder(orderId);
      expect(row.status).toBe(status);
      expect(row.payfastPaymentId).toBe("original");
    },
  );
});

describe("POST /api/payfast/notify: money that does not reconcile", () => {
  it("flags an order whose amount was tampered with, and never pays it", async () => {
    const orderId = await pendingOrder(998);
    // Correctly signed, genuinely from "PayFast", and claiming R 1 paid an
    // R 998 order. The signature has nothing to say about this; the order row does.
    const fields = itn(orderId, { amount_gross: "1.00" });

    const response = await notify(post(fields));
    expect(response.status).toBe(200);

    const row = await readOrder(orderId);
    expect(row.status).toBe("flagged");
    expect(row.status).not.toBe("paid");
    expect(row.payfastPaymentId).toBeNull();

    expect(await outcomeOf(fields.pf_payment_id)).toBe("amount-mismatch");
  });

  it("flags an amount that is too high as readily as one that is too low", async () => {
    const orderId = await pendingOrder(998);
    const fields = itn(orderId, { amount_gross: "9980.00" });
    await notify(post(fields));

    // Overpayment is not a happy accident, it is a reconciliation problem.
    expect((await readOrder(orderId)).status).toBe("flagged");
  });

  it("flags a missing amount rather than reading it as agreement", async () => {
    const orderId = await pendingOrder();
    const fields = itn(orderId, { amount_gross: "" });
    await notify(post(fields));
    expect((await readOrder(orderId)).status).toBe("flagged");
  });

  it("records an unknown order without crashing or paying anything", async () => {
    const fields = itn("00000000-0000-0000-0000-000000000000");
    const response = await notify(post(fields));

    expect(response.status).toBe(200);
    expect(await outcomeOf(fields.pf_payment_id)).toBe("order-not-found");
  });

  it("survives an m_payment_id that is not even a uuid", async () => {
    const fields = itn("not-a-uuid-at-all");
    const response = await notify(post(fields));

    // A malformed id never matches a row: an unknown order, not a 500.
    expect(response.status).toBe(200);
    expect(await outcomeOf(fields.pf_payment_id)).toBe("order-not-found");
  });
});

describe("POST /api/payfast/notify: payments that did not happen", () => {
  it.each(["FAILED", "CANCELLED", "PENDING", "complete "])(
    "leaves an order pending on payment_status %p",
    async (status) => {
      const orderId = await pendingOrder();
      const fields = itn(orderId, { payment_status: status });

      const response = await notify(post(fields));
      expect(response.status).toBe(200);

      const row = await readOrder(orderId);
      expect(row.status).toBe("pending");
      expect(row.payfastPaymentId).toBeNull();
    },
  );

  it("generates no print file for a payment that did not happen", async () => {
    const orderId = await pendingOrder();
    await notify(post(itn(orderId, { payment_status: "FAILED" })));

    // The cost principle, at the only place it can be enforced: a print file is
    // real money, so nothing schedules one until an order is genuinely paid.
    expect(afterTasks).toHaveLength(0);
  });

  it("records why it ignored a failed payment", async () => {
    const orderId = await pendingOrder();
    const fields = itn(orderId, { payment_status: "FAILED" });
    await notify(post(fields));
    expect(await outcomeOf(fields.pf_payment_id)).toBe("ignored-status:FAILED");
  });
});

describe("POST /api/payfast/notify: payloads we cannot trust", () => {
  it("rejects a bad signature and leaves the order alone", async () => {
    const orderId = await pendingOrder();
    const fields = { ...itn(orderId), signature: "0".repeat(32) };

    const response = await notify(post(fields));
    expect(response.status).toBe(400);
    expect((await readOrder(orderId)).status).toBe("pending");
  });

  it("rejects a payload signed with the wrong passphrase", async () => {
    const orderId = await pendingOrder();
    const fields = itn(orderId, {}, "not-our-passphrase");

    const response = await notify(post(fields));
    expect(response.status).toBe(400);
    expect((await readOrder(orderId)).status).toBe("pending");
  });

  it("rejects an unsigned payload", async () => {
    const orderId = await pendingOrder();
    const { signature, ...unsigned } = itn(orderId);
    expect(signature).toBeTruthy();

    const response = await notify(post(unsigned));
    expect(response.status).toBe(400);
    expect((await readOrder(orderId)).status).toBe("pending");
  });

  it("rejects an ITN for somebody else's merchant id", async () => {
    const orderId = await pendingOrder();
    // Correctly signed under our passphrase, but not addressed to our shop.
    const fields = itn(orderId, { merchant_id: "99999999" });

    const response = await notify(post(fields));
    expect(response.status).toBe(400);
    expect((await readOrder(orderId)).status).toBe("pending");
  });

  it("rejects every ITN when the shop has no merchant id to check against", async () => {
    vi.stubEnv("PAYFAST_MERCHANT_ID", "");
    const orderId = await pendingOrder();

    // Fail closed: with nothing to compare against we cannot know a payment is
    // even meant for us, and guessing is how you pay out someone else's order.
    const response = await notify(post(itn(orderId, { merchant_id: "" })));
    expect(response.status).toBe(400);
    expect((await readOrder(orderId)).status).toBe("pending");
  });

  it("rejects an ITN with no pf_payment_id, having nothing to key on", async () => {
    const orderId = await pendingOrder();
    const response = await notify(post(itn(orderId, { pf_payment_id: "" })));

    expect(response.status).toBe(400);
    expect((await readOrder(orderId)).status).toBe("pending");
  });

  it.each([
    ["", "an empty body"],
    ["   ", "whitespace"],
    ["not a form at all", "junk"],
  ])("rejects %p (%s)", async (body) => {
    const response = await notify(
      new Request("http://localhost/api/payfast/notify", {
        method: "POST",
        body,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }),
    );
    expect(response.status).toBe(400);
  });

  it("refuses a repeated field rather than guessing which copy was signed", async () => {
    const orderId = await pendingOrder();
    const fields = itn(orderId);
    const body =
      new URLSearchParams(fields).toString() + "&amount_gross=1.00";

    const response = await notify(
      new Request("http://localhost/api/payfast/notify", {
        method: "POST",
        body,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }),
    );

    expect(response.status).toBe(400);
    expect((await readOrder(orderId)).status).toBe("pending");
  });

  it("never lets an unverified payload claim the idempotency key", async () => {
    // The attack the ordering exists to stop. Someone posts junk carrying the
    // pf_payment_id a real notification is about to use. If the webhook
    // recorded events before verifying them, that junk would own the unique key
    // and the genuine ITN behind it would be swallowed as "already handled",
    // leaving a paid-for order sitting at pending forever.
    const orderId = await pendingOrder();
    const real = itn(orderId);

    const forged = { ...real, signature: "f".repeat(32) };
    expect((await notify(post(forged))).status).toBe(400);
    expect(await eventsFor(real.pf_payment_id)).toHaveLength(0);

    // The real one still gets through and still pays the order.
    expect((await notify(post(real))).status).toBe(200);
    expect((await readOrder(orderId)).status).toBe("paid");
  });

  it("says nothing about why it refused", async () => {
    const orderId = await pendingOrder();
    const response = await notify(post({ ...itn(orderId), signature: "0".repeat(32) }));
    const text = await response.text();

    // A webhook that explains itself is a tuning oracle for the next attempt.
    expect(text).not.toMatch(/signature|passphrase|merchant|order/i);
  });

  it("never puts a secret in a response", async () => {
    const orderId = await pendingOrder();
    for (const fields of [itn(orderId), { ...itn(orderId), signature: "0".repeat(32) }]) {
      const text = await (await notify(post(fields))).text();
      expect(text).not.toContain(PASSPHRASE);
      expect(text).not.toContain("46f0cd694581a");
    }
  });
});

describe("POST /api/payfast/notify: proving it came from PayFast", () => {
  /** Credentials present, MOCK_SERVICES off: the source check is live. */
  function liveSourceCheck() {
    vi.stubEnv("MOCK_SERVICES", "");
  }

  it("posts the payload back to PayFast and requires VALID", async () => {
    liveSourceCheck();
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(new Response("VALID", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    const orderId = await pendingOrder();
    const fields = itn(orderId);
    const response = await notify(post(fields));

    expect(response.status).toBe(200);
    expect((await readOrder(orderId)).status).toBe("paid");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    // Confirmed against the sandbox host, because this is a sandbox payment.
    expect(url).toBe("https://sandbox.payfast.co.za/eng/query/validate");
    expect(init.method).toBe("POST");
    // Verbatim: PayFast checks it against what they sent, not against a
    // re-encoding of it.
    expect(init.body).toBe(new URLSearchParams(fields).toString());
  });

  it("rejects a payload PayFast disowns", async () => {
    liveSourceCheck();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("INVALID", { status: 200 })),
    );

    const orderId = await pendingOrder();
    const fields = itn(orderId);

    // Correctly signed: this is the case where our passphrase has leaked and
    // somebody is posting their own notifications. The signature says yes and
    // PayFast says they never sent it.
    const response = await notify(post(fields));
    expect(response.status).toBe(400);
    expect((await readOrder(orderId)).status).toBe("pending");
    expect(await eventsFor(fields.pf_payment_id)).toHaveLength(0);
  });

  it("does not pay an order when PayFast cannot be reached", async () => {
    liveSourceCheck();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ETIMEDOUT")));

    const orderId = await pendingOrder();
    const response = await notify(post(itn(orderId)));

    // Unconfirmed is unconfirmed. A non-200 asks PayFast to send it again,
    // which is exactly what their retry schedule is for.
    expect(response.status).toBe(400);
    expect((await readOrder(orderId)).status).toBe("pending");
  });

  it("does not accept a confirmation host that answers with an error", async () => {
    liveSourceCheck();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("VALID", { status: 500 })),
    );

    const orderId = await pendingOrder();
    expect((await notify(post(itn(orderId)))).status).toBe(400);
    expect((await readOrder(orderId)).status).toBe("pending");
  });

  it("cannot be skipped in production by MOCK_SERVICES alone", async () => {
    // The one that matters. MOCK_SERVICES is a legitimate production toggle
    // elsewhere in this codebase, so it must not be enough on its own to turn
    // off the check that proves a payment came from PayFast.
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MOCK_SERVICES", "true");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("INVALID", { status: 200 })),
    );

    const orderId = await pendingOrder();
    const response = await notify(post(itn(orderId)));

    expect(response.status).toBe(400);
    expect((await readOrder(orderId)).status).toBe("pending");
  });

  it("makes no network call at all in local mock mode", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const orderId = await pendingOrder();
    expect((await notify(post(itn(orderId)))).status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("POST /api/payfast/notify: the account behind a payment (D3)", () => {
  async function customersFor(email: string) {
    const db = await getDb();
    return db.select().from(customers).where(eq(customers.email, email));
  }

  it("creates the customer and claims the order the moment payment clears", async () => {
    // The buyer never returns from PayFast: the account must exist anyway.
    const email = `itn.claim.${Date.now()}@example.co.za`;
    const orderId = await pendingOrder(TOTAL_ZAR, email);

    const response = await notify(post(itn(orderId)));
    expect(response.status).toBe(200);

    const found = await customersFor(email);
    expect(found).toHaveLength(1);

    const row = await readOrder(orderId);
    expect(row.status).toBe("paid");
    expect(row.customerId).toBe(found[0].id);
  });

  it("claims every unclaimed order for the email, onto one account", async () => {
    const email = `itn.two.${Date.now()}@example.co.za`;
    const first = await pendingOrder(TOTAL_ZAR, email);
    const second = await pendingOrder(TOTAL_ZAR, email);

    await notify(post(itn(first)));
    await notify(post(itn(second)));

    // Still one account.
    const found = await customersFor(email);
    expect(found).toHaveLength(1);
    // Both orders belong to it.
    expect((await readOrder(first)).customerId).toBe(found[0].id);
    expect((await readOrder(second)).customerId).toBe(found[0].id);
  });

  it("creates no account for money that did not reconcile", async () => {
    // An amount mismatch flags the order and proves nothing about the email.
    const email = `itn.mismatch.${Date.now()}@example.co.za`;
    const orderId = await pendingOrder(TOTAL_ZAR, email);

    const response = await notify(
      post(itn(orderId, { amount_gross: "1.00" })),
    );
    expect(response.status).toBe(200);

    expect((await readOrder(orderId)).status).toBe("flagged");
    expect(await customersFor(email)).toHaveLength(0);
  });

  it("creates no account for a payment that did not complete", async () => {
    const email = `itn.failed.${Date.now()}@example.co.za`;
    const orderId = await pendingOrder(TOTAL_ZAR, email);

    await notify(post(itn(orderId, { payment_status: "FAILED" })));

    expect((await readOrder(orderId)).status).toBe("pending");
    expect(await customersFor(email)).toHaveLength(0);
  });
});
