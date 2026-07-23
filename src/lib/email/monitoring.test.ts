// @vitest-environment node
import { randomUUID } from "node:crypto";
import { describe, it, expect, afterEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  orderEmailSummary,
  recordEmailEvent,
  recordOrderEmailSend,
} from "./monitoring";
import { getDb } from "@/lib/db/client";
import { emailEvents, orderEmails, orders } from "@/lib/db/schema";

/**
 * The delivery ledger. The invariants under test are the ones the money paths
 * lean on: recording NEVER throws (a ledger hiccup must not unwind a send, a
 * webhook 200 or a paid order), a bounce marks the order for a human, and
 * nothing in here sends mail.
 */

const state = vi.hoisted(() => ({ dbDown: false }));

vi.mock("@/lib/db/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/client")>();
  return {
    ...actual,
    getDb: async () => {
      if (state.dbDown) throw new Error("database is down");
      return actual.getDb();
    },
  };
});

afterEach(() => {
  state.dbDown = false;
  vi.restoreAllMocks();
});

/** A paid order, minimal but real, so foreign keys hold. */
async function paidOrder(email = "thandi@example.co.za"): Promise<string> {
  const db = await getDb();
  const id = randomUUID();
  await db.insert(orders).values({
    id,
    status: "sent_to_printer",
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
    totalZar: 998,
    payfastPaymentId: `pf-${id.slice(0, 8)}`,
  });
  return id;
}

async function sendsFor(orderId: string) {
  const db = await getDb();
  return db.select().from(orderEmails).where(eq(orderEmails.orderId, orderId));
}

async function readOrder(orderId: string) {
  const db = await getDb();
  const [row] = await db.select().from(orders).where(eq(orders.id, orderId));
  return row;
}

describe("recordOrderEmailSend", () => {
  it("keys a successful send to its order", async () => {
    const orderId = await paidOrder();
    const messageId = `msg-${randomUUID()}`;

    await recordOrderEmailSend(orderId, "confirmation", "thandi@example.co.za", {
      ok: true,
      id: messageId,
    });

    const rows = await sendsFor(orderId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: "confirmation",
      recipient: "thandi@example.co.za",
      messageId,
    });
  });

  it("records nothing for a failed send", async () => {
    const orderId = await paidOrder();
    await recordOrderEmailSend(orderId, "confirmation", "thandi@example.co.za", {
      ok: false,
      error: new Error("mailbox on fire"),
    });
    expect(await sendsFor(orderId)).toHaveLength(0);
  });

  it("treats a replayed message id as already recorded", async () => {
    const orderId = await paidOrder();
    const result = { ok: true as const, id: `msg-${randomUUID()}` };

    await recordOrderEmailSend(orderId, "job-sheet", "print@example.co.za", result);
    await recordOrderEmailSend(orderId, "job-sheet", "print@example.co.za", result);

    expect(await sendsFor(orderId)).toHaveLength(1);
  });

  it("never throws, even at a garbage order id", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      recordOrderEmailSend("not-a-uuid", "shipping", "x@example.co.za", {
        ok: true,
        id: `msg-${randomUUID()}`,
      }),
    ).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
  });

  it("never throws when the database is down; the send stands", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    state.dbDown = true;
    await expect(
      recordOrderEmailSend(randomUUID(), "confirmation", "x@example.co.za", {
        ok: true,
        id: `msg-${randomUUID()}`,
      }),
    ).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
  });
});

describe("recordEmailEvent", () => {
  it("records the event and associates it to the order via the message id", async () => {
    const orderId = await paidOrder();
    const messageId = `msg-${randomUUID()}`;
    await recordOrderEmailSend(orderId, "confirmation", "thandi@example.co.za", {
      ok: true,
      id: messageId,
    });

    const result = await recordEmailEvent(
      "delivered",
      messageId,
      "thandi@example.co.za",
      '{"type":"email.delivered"}',
    );

    expect(result).toEqual({ recorded: true, orderId, flaggedBounce: false });

    const db = await getDb();
    const events = await db
      .select()
      .from(emailEvents)
      .where(eq(emailEvents.messageId, messageId));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "delivered",
      orderId,
      recipient: "thandi@example.co.za",
    });
  });

  it("keeps an event for mail never keyed to an order, with a null orderId", async () => {
    const messageId = `msg-${randomUUID()}`;
    const result = await recordEmailEvent(
      "delivered",
      messageId,
      "someone@example.co.za",
      "{}",
    );
    expect(result).toEqual({
      recorded: true,
      orderId: null,
      flaggedBounce: false,
    });
  });

  it("a bounce of an order email marks the order for a human", async () => {
    const orderId = await paidOrder();
    const messageId = `msg-${randomUUID()}`;
    await recordOrderEmailSend(orderId, "confirmation", "thandi@example.co.za", {
      ok: true,
      id: messageId,
    });

    const result = await recordEmailEvent(
      "bounced",
      messageId,
      "thandi@example.co.za",
      '{"type":"email.bounced"}',
    );

    expect(result.flaggedBounce).toBe(true);
    const order = await readOrder(orderId);
    expect(order?.emailBouncedAt).toBeInstanceOf(Date);
    // The bounce is a note beside the order, never a change to its lifecycle:
    // flagged means money/print trouble, and this order has neither.
    expect(order?.status).toBe("sent_to_printer");
  });

  it("a bounce of unkeyed mail marks nothing", async () => {
    const result = await recordEmailEvent(
      "bounced",
      `msg-${randomUUID()}`,
      "stranger@example.co.za",
      "{}",
    );
    expect(result.flaggedBounce).toBe(false);
  });

  it("a Svix delivery retry does not double-record", async () => {
    const messageId = `msg-${randomUUID()}`;
    await recordEmailEvent("delivered", messageId, "x@example.co.za", "{}");
    await recordEmailEvent("delivered", messageId, "x@example.co.za", "{}");

    const db = await getDb();
    const events = await db
      .select()
      .from(emailEvents)
      .where(eq(emailEvents.messageId, messageId));
    expect(events).toHaveLength(1);
  });

  it("never throws when persistence hiccups; it reports recorded:false", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    state.dbDown = true;
    const result = await recordEmailEvent(
      "bounced",
      `msg-${randomUUID()}`,
      "x@example.co.za",
      "{}",
    );
    expect(result.recorded).toBe(false);
    expect(spy).toHaveBeenCalled();
  });
});

describe("orderEmailSummary", () => {
  it("is null for an order with no recorded mail", async () => {
    const orderId = await paidOrder();
    expect(await orderEmailSummary(orderId)).toEqual({ status: null, sends: [] });
  });

  it("is 'sent' when nothing has come back yet", async () => {
    const orderId = await paidOrder();
    await recordOrderEmailSend(orderId, "confirmation", "thandi@example.co.za", {
      ok: true,
      id: `msg-${randomUUID()}`,
    });
    const summary = await orderEmailSummary(orderId);
    expect(summary.status).toBe("sent");
    expect(summary.sends).toHaveLength(1);
    expect(summary.sends[0].outcome).toBe("sent");
  });

  it("is 'delivered' once the provider confirms delivery", async () => {
    const orderId = await paidOrder();
    const messageId = `msg-${randomUUID()}`;
    await recordOrderEmailSend(orderId, "confirmation", "thandi@example.co.za", {
      ok: true,
      id: messageId,
    });
    await recordEmailEvent("delivered", messageId, "thandi@example.co.za", "{}");
    expect((await orderEmailSummary(orderId)).status).toBe("delivered");
  });

  it("a single bounce outranks every delivered mail on the order", async () => {
    const orderId = await paidOrder();
    const deliveredId = `msg-${randomUUID()}`;
    const bouncedId = `msg-${randomUUID()}`;
    await recordOrderEmailSend(orderId, "confirmation", "thandi@example.co.za", {
      ok: true,
      id: deliveredId,
    });
    await recordOrderEmailSend(orderId, "shipping", "thandi@example.co.za", {
      ok: true,
      id: bouncedId,
    });
    await recordEmailEvent("delivered", deliveredId, "thandi@example.co.za", "{}");
    await recordEmailEvent("bounced", bouncedId, "thandi@example.co.za", "{}");

    const summary = await orderEmailSummary(orderId);
    expect(summary.status).toBe("bounced");
    const outcomes = new Map(
      summary.sends.map((send) => [send.messageId, send.outcome]),
    );
    expect(outcomes.get(deliveredId)).toBe("delivered");
    expect(outcomes.get(bouncedId)).toBe("bounced");
  });

  it("is safe on a malformed order id", async () => {
    expect(await orderEmailSummary("not-a-uuid")).toEqual({
      status: null,
      sends: [],
    });
  });
});
