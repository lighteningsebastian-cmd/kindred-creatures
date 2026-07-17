// @vitest-environment node
import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { markPrinted, markShipped, ALLOWED_FROM } from "./fulfillment-ops";
import { getDb } from "@/lib/db/client";
import {
  fulfillmentEvents,
  orders,
  type OrderStatus,
} from "@/lib/db/schema";

/**
 * The transitions the owner drives by hand, tested from the server side only.
 *
 * Every case here is a way to move an order somewhere it must not go while the
 * UI is doing nothing wrong: a stale tab, a double click, a hand-written POST.
 * The buttons are not in these tests on purpose. A guard that only exists in a
 * component is not a guard, so what is asserted is that the module refuses even
 * when nothing rendered.
 */

const { sendShippingNotificationMock } = vi.hoisted(() => ({
  sendShippingNotificationMock: vi.fn(),
}));

vi.mock("@/lib/email", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email")>()),
  sendShippingNotification: sendShippingNotificationMock,
}));

beforeEach(() => {
  vi.stubEnv("MOCK_SERVICES", "true");
  sendShippingNotificationMock.mockResolvedValue({ ok: true, id: "ship-1" });
});

afterEach(() => {
  vi.unstubAllEnvs();
  sendShippingNotificationMock.mockReset();
});

async function orderAt(
  status: OrderStatus,
  payfastPaymentId: string | null = "1000001",
): Promise<string> {
  const db = await getDb();
  const id = randomUUID();
  await db.insert(orders).values({
    id,
    status,
    payfastPaymentId,
    email: "thandi@example.co.za",
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
  });
  return id;
}

async function readOrder(id: string) {
  const db = await getDb();
  const [row] = await db.select().from(orders).where(eq(orders.id, id));
  return row;
}

async function eventsFor(id: string) {
  const db = await getDb();
  return db
    .select()
    .from(fulfillmentEvents)
    .where(eq(fulfillmentEvents.orderId, id));
}

/** Every status that is NOT the one a transition is allowed to start from. */
const ALL_STATUSES: OrderStatus[] = [
  "pending",
  "paid",
  "sent_to_printer",
  "printed",
  "shipped",
  "flagged",
];

describe("markPrinted", () => {
  it("moves sent_to_printer to printed", async () => {
    const id = await orderAt("sent_to_printer");

    const result = await markPrinted(id);

    expect(result.ok).toBe(true);
    expect((await readOrder(id)).status).toBe("printed");
  });

  it("records the transition on the timeline", async () => {
    const id = await orderAt("sent_to_printer");
    await markPrinted(id);

    const events = await eventsFor(id);
    expect(events).toHaveLength(1);
    expect(events[0].step).toBe("fulfil");
    expect(events[0].outcome).toBe("ok");
  });

  it.each(ALL_STATUSES.filter((status) => status !== "sent_to_printer"))(
    "refuses to print an order at %s, and leaves it there",
    async (status) => {
      const id = await orderAt(status);

      const result = await markPrinted(id);

      expect(result).toEqual({ ok: false, reason: "wrong-status" });
      expect((await readOrder(id)).status).toBe(status);
    },
  );

  it("refuses an order that does not exist", async () => {
    const result = await markPrinted(randomUUID());
    expect(result).toEqual({ ok: false, reason: "order-not-found" });
  });

  it("refuses a malformed id rather than throwing", async () => {
    await expect(markPrinted("not-a-uuid")).resolves.toEqual({
      ok: false,
      reason: "order-not-found",
    });
  });
});

describe("markShipped", () => {
  it("moves printed to shipped, storing the waybill", async () => {
    const id = await orderAt("printed");

    const result = await markShipped(id, "TCG123456789");

    expect(result.ok).toBe(true);
    const order = await readOrder(id);
    expect(order.status).toBe("shipped");
    expect(order.trackingNumber).toBe("TCG123456789");
  });

  it("notifies the customer, from the row that already has the waybill on it", async () => {
    const id = await orderAt("printed");

    await markShipped(id, "TCG123456789");

    expect(sendShippingNotificationMock).toHaveBeenCalledTimes(1);
    // sendShippingNotification throws a TypeError without this. The only order
    // it is ever handed is one the UPDATE has just confirmed carries a number.
    const [notified] = sendShippingNotificationMock.mock.calls[0];
    expect(notified.trackingNumber).toBe("TCG123456789");
    expect(notified.status).toBe("shipped");
  });

  it("requires a tracking number", async () => {
    const id = await orderAt("printed");

    const result = await markShipped(id, "");

    expect(result).toEqual({ ok: false, reason: "tracking-required" });
    expect((await readOrder(id)).status).toBe("printed");
    expect(sendShippingNotificationMock).not.toHaveBeenCalled();
  });

  it("treats a whitespace-only tracking number as absent", async () => {
    const id = await orderAt("printed");

    const result = await markShipped(id, "   ");

    expect(result).toEqual({ ok: false, reason: "tracking-required" });
    expect((await readOrder(id)).trackingNumber).toBeNull();
  });

  it("trims the waybill: the customer must be able to paste it", async () => {
    const id = await orderAt("printed");

    await markShipped(id, "  TCG123456789 ");

    expect((await readOrder(id)).trackingNumber).toBe("TCG123456789");
  });

  it.each(ALL_STATUSES.filter((status) => status !== "printed"))(
    "refuses to ship an order at %s, and sends no email",
    async (status) => {
      const id = await orderAt(status);

      const result = await markShipped(id, "TCG123456789");

      expect(result).toEqual({ ok: false, reason: "wrong-status" });
      const order = await readOrder(id);
      expect(order.status).toBe(status);
      expect(order.trackingNumber).toBeNull();
      expect(sendShippingNotificationMock).not.toHaveBeenCalled();
    },
  );

  it("does NOT unship the order when the email fails", async () => {
    // The parcel is with the courier either way. Rolling the status back to make
    // the mail's failure disappear would be lying about where it is.
    sendShippingNotificationMock.mockResolvedValue({
      ok: false,
      error: new Error("smtp is down"),
    });
    const id = await orderAt("printed");

    const result = await markShipped(id, "TCG123456789");

    expect(result.ok).toBe(true);
    expect(result.ok && result.email?.ok).toBe(false);
    const order = await readOrder(id);
    expect(order.status).toBe("shipped");
    expect(order.trackingNumber).toBe("TCG123456789");
  });

  it("leaves the failed email on the timeline, so it can be chased", async () => {
    sendShippingNotificationMock.mockResolvedValue({
      ok: false,
      error: new Error("smtp is down"),
    });
    const id = await orderAt("printed");

    await markShipped(id, "TCG123456789");

    const events = await eventsFor(id);
    expect(events.some((event) => event.outcome === "failed")).toBe(true);
  });

  it("refuses an order that does not exist", async () => {
    const result = await markShipped(randomUUID(), "TCG123456789");
    expect(result).toEqual({ ok: false, reason: "order-not-found" });
  });
});

describe("the transition table", () => {
  it("has no route to paid, by hand or otherwise", () => {
    // Only a verified PayFast ITN may write "paid". An admin control that did it
    // would make ITN verification optional, since the way to pay for a garment
    // would become asking us nicely. This asserts the absence deliberately: if
    // someone adds it, a test fails rather than a garment ships.
    expect(Object.keys(ALLOWED_FROM)).not.toContain("paid");
    expect(Object.values(ALLOWED_FROM)).not.toContain("pending");
  });

  it("only allows the two steps the shop actually performs", () => {
    expect(ALLOWED_FROM).toEqual({
      printed: "sent_to_printer",
      shipped: "printed",
    });
  });
});
